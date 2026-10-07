/** A uniform random number in [0, 1) from the browser's or Node's secure generator. */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}
