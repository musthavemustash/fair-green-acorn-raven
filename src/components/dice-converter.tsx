import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, RotateCcw, Trash2 } from "lucide-react";
import {
  DIE_FACES,
  FACE_BITS,
  REQUIRED_FACES,
  appendFace,
  isDieFace,
  isReroll,
  mnemonicFromRolls,
  rollsToBitString,
  testPattern,
  undoFace,
  type DieFace,
} from "@/lib/dice";

type Notice = "reroll" | "full" | null;
type Armed = "clear" | "test" | null;

const PATTERN_LAST_WORD = "guard";

export function DiceConverter() {
  const [rolls, setRolls] = useState<readonly DieFace[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"words" | "bits" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const ledgerRef = useRef<HTMLOListElement>(null);
  const rollsRef = useRef(rolls);
  rollsRef.current = rolls;

  const bits = rollsToBitString(rolls);
  const full = rolls.length >= REQUIRED_FACES;
  const last = rolls.length > 0 ? rolls[rolls.length - 1] : null;

  const record = useCallback((face: DieFace) => {
    setArmed(null);
    if (rollsRef.current.length >= REQUIRED_FACES) {
      setNotice("full");
      return;
    }
    setNotice(null);
    setRolls((prev) => appendFace(prev, face));
  }, []);

  const reroll = useCallback(() => {
    setArmed(null);
    setNotice("reroll");
  }, []);

  const undo = useCallback(() => {
    setArmed(null);
    setNotice(null);
    setCopied(null);
    setRolls((prev) => undoFace(prev));
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (event.key >= "1" && event.key <= "6") {
        const value = Number(event.key);
        event.preventDefault();
        if (isDieFace(value)) record(value);
        else if (isReroll(value)) reroll();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record, reroll, undo]);

  useEffect(() => {
    const el = ledgerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rolls.length]);

  useEffect(() => {
    if (rolls.length !== REQUIRED_FACES) {
      setWords(null);
      setPhraseError(null);
      return;
    }
    let cancelled = false;
    mnemonicFromRolls(rolls).then(
      (next) => {
        if (!cancelled) {
          setWords(next);
          setPhraseError(null);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setWords(null);
          setPhraseError(error instanceof Error ? error.message : "Could not build the phrase");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [rolls]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  function clearAll() {
    if (rolls.length === 0) return;
    if (armed !== "clear") {
      setArmed("clear");
      return;
    }
    setArmed(null);
    setNotice(null);
    setCopied(null);
    setRolls([]);
  }

  function loadTest() {
    if (rolls.length > 0 && armed !== "test") {
      setArmed("test");
      return;
    }
    setArmed(null);
    setNotice(null);
    setCopied(null);
    setRolls(testPattern());
  }

  async function downloadOfflineFile() {
    try {
      const response = await fetch("/dice-converter.html");
      if (!response.ok) throw new Error("missing");
      const blob = await response.blob();
      const url = URL.createObjectURL(new Blob([await blob.arrayBuffer()], { type: "text/html" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "dice-converter.html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadNote("Saved as dice-converter.html. Open it from your downloads folder.");
    } catch {
      setDownloadNote("Download was blocked. Use the link and choose Save As.");
    }
  }

  async function copyText(kind: "words" | "bits", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(false);
      setCopied(kind);
    } catch {
      setCopied(null);
      setCopyError(true);
    }
  }

  const patternMatched =
    words !== null &&
    rolls.length === REQUIRED_FACES &&
    rolls.every((face, index) => face === ((index % 4) + 1));
  const patternOk = patternMatched && words[23] === PATTERN_LAST_WORD;

  let status = "No faces recorded yet. Tap a die or press 1, 2, 3, or 4.";
  if (notice === "reroll") status = "Re-roll. 5 and 6 are not recorded.";
  else if (notice === "full") status = "128 faces are already recorded. Undo one, or clear the record.";
  else if (last) status = `Recorded face ${last} as ${FACE_BITS[last]}.`;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">Plebum Dominium</p>
        <h1 className="mt-2 text-3xl font-semibold text-fg">Dice Converter</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Roll casino dice. Keep 1, 2, 3, and 4. Re-roll 5 and 6 — those faces are not
          recorded. Each kept face is two bits. 128 faces make a 24-word phrase.
        </p>
      </header>

      <aside className="mb-6 rounded-lg border border-line bg-card px-4 py-3 text-sm leading-relaxed text-fg">
        Practice only. Rolls stay on this screen until you clear them or leave. They are
        not saved. Do not enter real dice on a connected device. Write a real phrase on
        paper, offline.
      </aside>

      <div className="mb-6">
        <button
          type="button"
          onClick={downloadOfflineFile}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          <Download className="size-4" aria-hidden="true" />
          Download the offline file
        </button>
        <a href="/dice-converter.html" download="dice-converter.html" className="ml-3 text-sm text-accent">
          or open dice-converter.html
        </a>
        {downloadNote ? <p className="mt-2 text-sm text-muted">{downloadNote}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DIE_FACES.map((face) => (
          <button
            key={face}
            type="button"
            onClick={() => record(face)}
            disabled={full}
            className="flex min-h-28 touch-manipulation select-none flex-col items-center justify-center gap-2 rounded-lg border border-line bg-card px-2 py-3 text-fg hover:border-accent active:scale-95 disabled:opacity-40"
            aria-label={`Record face ${face} as bits ${FACE_BITS[face]}`}
          >
            <DieGlyph face={face} />
            <span className="font-mono text-sm text-muted tabular-nums">
              {face} = {FACE_BITS[face]}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 min-h-12 font-mono text-sm leading-relaxed text-fg" aria-live="polite">
        {status}
      </p>

      <section className="rounded-lg border border-line bg-card p-4" aria-label="Progress">
        <div className="flex items-baseline justify-between gap-3 font-mono text-sm">
          <span className="text-fg tabular-nums">Faces {rolls.length} / {REQUIRED_FACES}</span>
          <span className="text-muted tabular-nums">Bits {bits.length} / 256</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={REQUIRED_FACES}
          aria-valuenow={rolls.length}
          aria-label="Faces recorded"
        >
          <div className="h-full bg-accent" style={{ width: `${(rolls.length / REQUIRED_FACES) * 100}%` }} />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={undo} disabled={rolls.length === 0} className={controlClass}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Undo
        </button>
        <button type="button" onClick={clearAll} disabled={rolls.length === 0} className={controlClass}>
          <Trash2 className="size-4" aria-hidden="true" />
          {armed === "clear" ? "Confirm" : "Clear"}
        </button>
        <button type="button" onClick={loadTest} className={controlClass}>
          {armed === "test" ? "Replace" : "Test"}
        </button>
      </div>
      {armed === "clear" ? (
        <p className="mt-2 text-sm text-muted">Tap Clear again to erase the whole record.</p>
      ) : null}
      {armed === "test" ? (
        <p className="mt-2 text-sm text-muted">
          Tap Test again to replace this record with 1, 2, 3, 4 repeated. Not real entropy.
        </p>
      ) : null}

      {phraseError ? (
        <p className="mt-6 text-sm text-fg" role="alert">
          {phraseError}
        </p>
      ) : null}

      {words ? (
        <section className="mt-6" aria-label="24 word phrase">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold text-fg">24 words</h2>
            <button
              type="button"
              onClick={() => copyText("words", words.join(" "))}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg"
            >
              <Copy className="size-4" aria-hidden="true" />
              {copied === "words" ? "Copied" : "Copy"}
            </button>
          </div>
          {patternMatched ? (
            <p className="mb-3 text-sm text-muted">
              {patternOk
                ? "Test pattern. The phrase matches the known BIP39 result, and the last word is guard."
                : "Test pattern. The phrase does not match the known BIP39 result. Do not use it."}
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted">
              Write these down in order. This screen is the only copy.
            </p>
          )}
          <ol className="grid grid-cols-2 gap-x-4 gap-y-2">
            {words.map((word, index) => (
              <li key={index} className="flex min-w-0 gap-2 border-b border-line py-1 font-mono text-sm">
                <span className="w-6 shrink-0 text-muted tabular-nums">{index + 1}</span>
                <span className="truncate text-fg">{word}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : full ? (
        <p className="mt-6 text-sm text-muted">Building the phrase…</p>
      ) : null}

      <section className="mt-8" aria-label="Roll record">
        <h2 className="text-lg font-semibold text-fg">Roll record</h2>
        <p className="mt-1 text-sm text-muted">
          Every kept face, in the order it was entered. Bits under the face are what got stored.
        </p>
        {rolls.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Nothing recorded yet.
          </p>
        ) : (
          <ol
            ref={ledgerRef}
            className="mt-4 grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-8"
          >
            {rolls.map((face, index) => {
              const current = index === rolls.length - 1;
              return (
                <li
                  key={index}
                  className={
                    "flex flex-col items-center rounded-lg border bg-card px-1 py-2 " +
                    (current ? "border-accent" : "border-line")
                  }
                >
                  <span className="font-mono text-xs text-muted tabular-nums">{index + 1}</span>
                  <span className="font-mono text-lg text-fg tabular-nums">{face}</span>
                  <span className="font-mono text-xs text-accent">{FACE_BITS[face]}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {bits.length > 0 ? (
        <details className="mt-6 rounded-lg border border-line bg-card px-4 py-3">
          <summary className="cursor-pointer font-mono text-sm text-fg">Bit string</summary>
          <p className="mt-3 text-sm text-muted">
            Roll order, two bits per face. An offline converter that takes this string as-is
            should print the same words.
          </p>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-fg">
            {bits}
          </pre>
          <button
            type="button"
            onClick={() => copyText("bits", bits)}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-fg hover:border-accent"
          >
            <Copy className="size-4" aria-hidden="true" />
            {copied === "bits" ? "Copied" : "Copy bits"}
          </button>
        </details>
      ) : null}

      {copyError ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Copy was blocked. Select the words or bits and copy them yourself.
        </p>
      ) : null}
    </main>
  );
}

const controlClass =
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-lg border border-line bg-card px-2 text-sm text-fg hover:border-accent disabled:opacity-40";

function DieGlyph({ face }: { face: DieFace }) {
  const pips: Record<DieFace, ReadonlyArray<readonly [number, number]>> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  };
  return (
    <svg viewBox="0 0 100 100" className="size-14 text-fg" aria-hidden="true">
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      {pips[face].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill="currentColor" />
      ))}
    </svg>
  );
}
