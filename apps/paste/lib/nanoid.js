// Short, URL-safe ID generator.
// Adapted from nanoid (https://github.com/ai/nanoid, MIT, (c) Andrey Sitnik):
// uniform random selection from a custom alphabet using a bitmask + rejection
// sampling over crypto random bytes (see nanoid's customRandom).
"use strict";
const crypto = require("crypto");
const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // URL-safe, no lookalikes (O, I, l, o)
function customAlphabet(alphabet = ALPHABET, size = 8) {
  const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1;
  const step = Math.ceil((1.6 * mask * size) / alphabet.length);
  return () => {
    let id = "";
    for (;;) {
      const bytes = crypto.randomBytes(step);
      for (let i = 0; i < step; i++) {
        const c = alphabet[bytes[i] & mask];
        if (c) { id += c; if (id.length === size) return id; }
      }
    }
  };
}
module.exports = { customAlphabet, nanoid: customAlphabet(ALPHABET, 8), ALPHABET };
