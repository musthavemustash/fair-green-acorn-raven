import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REQUIRED_FACES,
  appendFace,
  bitStringToBytes,
  isDieFace,
  isReroll,
  mnemonicFromRolls,
  rollsToBitString,
  testPattern,
} from "./dice.ts";

test("each kept face is recorded as two bits, in order", () => {
  assert.equal(rollsToBitString([1, 2, 3, 4]), "00011011");
  assert.equal(bitStringToBytes("00011011")[0], 0b00011011);
});

test("5 and 6 are re-rolls, not faces", () => {
  assert.equal(isReroll(5), true);
  assert.equal(isReroll(6), true);
  assert.equal(isDieFace(5), false);
  assert.equal(isDieFace(4), true);
});

test("the record stops at 128 faces", () => {
  let rolls: readonly (1 | 2 | 3 | 4)[] = [];
  for (let i = 0; i < 200; i++) rolls = appendFace(rolls, 1);
  assert.equal(rolls.length, REQUIRED_FACES);
  assert.equal(appendFace(rolls, 2), rolls);
});

test("128 ones is the BIP39 zero phrase", async () => {
  const rolls = Array.from({ length: REQUIRED_FACES }, () => 1 as const);
  const words = await mnemonicFromRolls(rolls);
  assert.equal(words.filter((word) => word === "abandon").length, 23);
  assert.equal(words[23], "art");
});

test("the 1-2-3-4 pattern matches the offline converter", async () => {
  const words = await mnemonicFromRolls(testPattern());
  assert.deepEqual(words, [
    "brand",
    "sugar",
    "short",
    "curtain",
    "random",
    "mirror",
    "hockey",
    "gloom",
    "brand",
    "sugar",
    "short",
    "curtain",
    "random",
    "mirror",
    "hockey",
    "gloom",
    "brand",
    "sugar",
    "short",
    "curtain",
    "random",
    "mirror",
    "hockey",
    "guard",
  ]);
});
