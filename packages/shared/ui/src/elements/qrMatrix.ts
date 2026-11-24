import {
  bchRemainder,
  ECC_M_BLOCKS,
  encodeByteDataCodewords,
  interleaveEccMBlocks,
} from './qrReedSolomon';

export interface QrMatrix {
  version: number;
  size: number;
  modules: boolean[][];
}

function getAlignmentCoords(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((size - 13) / (count - 1) / 2) * 2;
  const coords = [6];
  for (let i = 1; i < count; i += 1) {
    coords.push(size - 7 - (count - 1 - i) * step);
  }
  return coords;
}

function applyMaskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function writeFormatInfo(modules: boolean[][], mask: number): void {
  const size = modules.length;
  const bits = ((mask << 10) | bchRemainder(mask << 10, 0x537, 11)) ^ 0x5412;
  const bitAt = (idx: number) => ((bits >>> idx) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) {
    modules[8]![i] = bitAt(14 - i);
    modules[i]![8] = bitAt(i);
  }
  modules[8]![7] = bitAt(8);
  modules[8]![8] = bitAt(7);
  modules[7]![8] = bitAt(6);

  for (let i = 0; i < 7; i += 1) {
    modules[size - 1 - i]![8] = bitAt(14 - i);
  }
  for (let i = 0; i < 8; i += 1) {
    modules[8]![size - 8 + i] = bitAt(7 - i);
  }
}

function hasFinderLikePattern(getBit: (idx: number) => boolean): boolean {
  const a =
    getBit(0) &&
    !getBit(1) &&
    getBit(2) &&
    getBit(3) &&
    getBit(4) &&
    !getBit(5) &&
    getBit(6) &&
    !getBit(7) &&
    !getBit(8) &&
    !getBit(9) &&
    !getBit(10);
  const b =
    !getBit(0) &&
    !getBit(1) &&
    !getBit(2) &&
    !getBit(3) &&
    getBit(4) &&
    !getBit(5) &&
    getBit(6) &&
    getBit(7) &&
    getBit(8) &&
    !getBit(9) &&
    getBit(10);
  return a || b;
}

function scoreMatrix(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;
  let darkCount = 0;

  for (let r = 0; r < size; r += 1) {
    let rowRun = 1;
    let colRun = 1;
    for (let c = 0; c < size; c += 1) {
      if (modules[r]![c]) darkCount += 1;
      if (c > 0) {
        if (modules[r]![c] === modules[r]![c - 1]) rowRun += 1;
        else {
          if (rowRun >= 5) penalty += 3 + (rowRun - 5);
          rowRun = 1;
        }
        if (modules[c]![r] === modules[c - 1]![r]) colRun += 1;
        else {
          if (colRun >= 5) penalty += 3 + (colRun - 5);
          colRun = 1;
        }
      }
      if (r < size - 1 && c < size - 1) {
        const b = modules[r]![c];
        if (b === modules[r]![c + 1] && b === modules[r + 1]![c] && b === modules[r + 1]![c + 1]) {
          penalty += 3;
        }
      }
      if (c <= size - 11) {
        if (hasFinderLikePattern(i => Boolean(modules[r]![c + i]))) penalty += 40;
        if (hasFinderLikePattern(i => Boolean(modules[c + i]![r]))) penalty += 40;
      }
    }
    if (rowRun >= 5) penalty += 3 + (rowRun - 5);
    if (colRun >= 5) penalty += 3 + (colRun - 5);
  }

  const pct = (darkCount * 100) / (size * size);
  const k = Math.min(Math.abs(Math.floor(pct / 5) * 5 - 50), Math.abs(Math.ceil(pct / 5) * 5 - 50));
  return penalty + (k / 5) * 10;
}

export function generateQrMatrix(value: string): QrMatrix {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('QR code value must be a non-empty string');
  }

  const bytes = new TextEncoder().encode(value);
  let version = 0;
  let totalDataBytes = 0;

  for (let v = 1; v <= ECC_M_BLOCKS.length; v += 1) {
    const [, g1c, g1s, g2c, g2s] = ECC_M_BLOCKS[v - 1]!;
    const dataCap = g1c * g1s + g2c * g2s;
    const overheadBits = 4 + (v <= 9 ? 8 : 16);
    if (bytes.length <= Math.floor((dataCap * 8 - overheadBits) / 8)) {
      version = v;
      totalDataBytes = dataCap;
      break;
    }
  }

  if (version === 0) {
    throw new Error('QR code payload exceeds maximum supported capacity');
  }

  const size = version * 4 + 17;
  const base = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFixed = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      base[r]![c] = dark;
      reserved[r]![c] = true;
    }
  };

  for (const [fr, fc] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const isDark =
          inFinder &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFixed(fr + r, fc + c, isDark);
      }
    }
  }

  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setFixed(6, i, dark);
    setFixed(i, 6, dark);
  }

  const align = getAlignmentCoords(version);
  for (const ar of align) {
    for (const ac of align) {
      if ((ar < 9 && ac < 9) || (ar < 9 && ac >= size - 8) || (ar >= size - 8 && ac < 9)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          setFixed(
            ar + dr,
            ac + dc,
            Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0),
          );
        }
      }
    }
  }

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      setFixed(8, i, false);
      setFixed(i, 8, false);
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    setFixed(8, i, false);
    setFixed(i, 8, false);
  }
  setFixed(size - 8, 8, true);

  if (version >= 7) {
    const verBits = (version << 12) | bchRemainder(version << 12, 0x1f25, 13);
    for (let k = 0; k < 18; k += 1) {
      const bit = ((verBits >>> k) & 1) === 1;
      const r = size - 11 + (k % 3);
      const c = Math.floor(k / 3);
      setFixed(r, c, bit);
      setFixed(c, r, bit);
    }
  }

  const encoded = interleaveEccMBlocks(
    encodeByteDataCodewords(bytes, version, totalDataBytes),
    version,
  );
  let bitIdx = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol -= 1;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = rightCol - offset;
        if (reserved[r]![c]) continue;
        const byteIndex = bitIdx >>> 3;
        const bitPos = 7 - (bitIdx & 7);
        base[r]![c] =
          byteIndex < encoded.length ? (((encoded[byteIndex] ?? 0) >>> bitPos) & 1) === 1 : false;
        bitIdx += 1;
      }
    }
    upward = !upward;
  }

  let bestModules = base;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = base.map((row, r) =>
      row.map((val, c) => (!reserved[r]![c] && applyMaskCondition(mask, r, c) ? !val : val)),
    );
    writeFormatInfo(candidate, mask);
    const score = scoreMatrix(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestModules = candidate;
    }
  }

  return { version, size, modules: bestModules };
}
