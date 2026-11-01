import { WORDLIST } from "./bip39-wordlist.ts";

/** Casino faces kept as entropy. 5 and 6 are a re-roll and are never stored. */
export type DieFace = 1 | 2 | 3 | 4;

export const DIE_FACES: readonly DieFace[] = [1, 2, 3, 4];

/** Two bits per kept face, most-significant bit first. 128 faces = 256 bits. */
export const FACE_BITS: Record<DieFace, string> = {
  1: "00",
  2: "01",
  3: "10",
  4: "11",
};

export const REQUIRED_FACES = 128;

export function isDieFace(value: number): value is DieFace {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** 5 and 6 carry no entropy in this scheme. */
export function isReroll(value: number): boolean {
  return value === 5 || value === 6;
}

/** Append one kept face. A full record is returned unchanged so a tap cannot spill past 256 bits. */
export function appendFace(
  rolls: readonly DieFace[],
  face: DieFace,
): readonly DieFace[] {
  if (rolls.length >= REQUIRED_FACES) return rolls;
  return [...rolls, face];
}

export function undoFace(rolls: readonly DieFace[]): DieFace[] {
  return rolls.slice(0, -1);
}

/** Repeating 1, 2, 3, 4. A known phrase, never real entropy. */
export function testPattern(): DieFace[] {
  const rolls: DieFace[] = [];
  for (let i = 0; i < REQUIRED_FACES; i++) {
    const face = ((i % 4) + 1) as DieFace;
    rolls.push(face);
  }
  return rolls;
}

export function rollsToBitString(rolls: readonly DieFace[]): string {
  let bits = "";
  for (const face of rolls) bits += FACE_BITS[face];
  return bits;
}

export function bitStringToBytes(bits: string): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error("Bit string is not a whole number of bytes");
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is unavailable in this browser");
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Uint8Array(await subtle.digest("SHA-256", copy));
}

/** Exactly 128 kept faces → BIP39 24-word mnemonic. Extra faces are not accepted. */
export async function mnemonicFromRolls(
  rolls: readonly DieFace[],
): Promise<string[]> {
  if (rolls.length !== REQUIRED_FACES) {
    throw new Error(`Need exactly ${REQUIRED_FACES} faces`);
  }
  const bits = rollsToBitString(rolls);
  if (bits.length !== 256) throw new Error("Entropy was not 256 bits");
  const entropy = bitStringToBytes(bits);
  const digest = await sha256(entropy);
  const checksum = (digest[0] ?? 0).toString(2).padStart(8, "0");
  const full = bits + checksum;
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    const index = Number.parseInt(full.slice(i * 11, (i + 1) * 11), 2);
    const word = WORDLIST[index];
    if (word === undefined) throw new Error(`Word index out of range: ${index}`);
    words.push(word);
  }
  return words;
}
