// ISO/IEC 18004 Table 9 — ECC Level M: [eccPerBlock, group1Blocks, group1Data, group2Blocks, group2Data]
export const ECC_M_BLOCKS: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

function buildRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i] ?? 1;
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ (poly[j] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j] ?? 0, root);
    }
    poly = next;
  }
  return poly;
}

export function computeRsEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = buildRsGenerator(eccCount);
  const rem = new Uint8Array(eccCount);
  for (const byte of data) {
    const factor = byte ^ (rem[0] ?? 0);
    rem.copyWithin(0, 1);
    rem[eccCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < eccCount; j += 1) {
        rem[j] = (rem[j] ?? 0) ^ gfMul(gen[j + 1] ?? 0, factor);
      }
    }
  }
  return rem;
}

export function bchRemainder(value: number, generator: number, genBits: number): number {
  const bitLen = (n: number) => {
    let bits = 0;
    let v = n;
    while (v > 0) {
      v >>>= 1;
      bits += 1;
    }
    return bits;
  };
  let rem = value;
  while (bitLen(rem) >= genBits) {
    rem ^= generator << (bitLen(rem) - genBits);
  }
  return rem;
}

export function encodeByteDataCodewords(
  bytes: Uint8Array,
  version: number,
  totalDataBytes: number,
): Uint8Array {
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const totalBits = totalDataBytes * 8;
  const terminator = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(totalDataBytes);
  for (let i = 0; i < bits.length / 8; i += 1) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    codewords[i] = byte;
  }

  let padIdx = bits.length / 8;
  let toggle = false;
  while (padIdx < totalDataBytes) {
    codewords[padIdx] = toggle ? 0x11 : 0xec;
    toggle = !toggle;
    padIdx += 1;
  }
  return codewords;
}

export function interleaveEccMBlocks(dataCodewords: Uint8Array, version: number): Uint8Array {
  const spec = ECC_M_BLOCKS[version - 1];
  if (!spec) throw new Error(`Unsupported QR version ${version}`);
  const [eccLen, g1Count, g1Size, g2Count, g2Size] = spec;

  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < g1Count; i += 1) {
    const slice = dataCodewords.subarray(offset, offset + g1Size);
    offset += g1Size;
    dataBlocks.push(slice);
    eccBlocks.push(computeRsEcc(slice, eccLen));
  }
  for (let i = 0; i < g2Count; i += 1) {
    const slice = dataCodewords.subarray(offset, offset + g2Size);
    offset += g2Size;
    dataBlocks.push(slice);
    eccBlocks.push(computeRsEcc(slice, eccLen));
  }

  const maxData = Math.max(g1Size, g2Size);
  const out = new Uint8Array(dataCodewords.length + (g1Count + g2Count) * eccLen);
  let pos = 0;
  for (let i = 0; i < maxData; i += 1) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        out[pos] = block[i] ?? 0;
        pos += 1;
      }
    }
  }
  for (let i = 0; i < eccLen; i += 1) {
    for (const block of eccBlocks) {
      out[pos] = block[i] ?? 0;
      pos += 1;
    }
  }
  return out;
}
