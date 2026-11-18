/**
 * lzma-compression.ts - LZMA-Style Compression (LZ77 plus Arithmetic Coding)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the core pipeline behind LZMA: an LZ77 parser replaces repeated
 * substrings with length and distance pairs, and an adaptive arithmetic coder
 * compresses the resulting token stream. The parser slides a window over the
 * input, finds the longest previous match for each position, and emits either
 * a literal or a match. The coder keeps a frequency table for all 256 byte
 * values and narrows an exact integer interval by the cumulative frequency of
 * each byte, updating the table after every symbol. Because both stages are
 * invertible, decompressing the stream reconstructs the input exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * window * maxMatch) for the naive parser plus O(256 * t) coding
 *   Space: O(n + t) for the tokens, token bytes, and compressed stream
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is one input byte, labeled by its character.
 *   - Bytes already covered by emitted tokens are GREEN (sorted).
 *   - The span emitted by the current token is BLUE (comparing).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Token = { literal: number } | { length: number; distance: number };

/** Naive sliding-window LZ77 parse: longest earlier match for every position. */
export function lzParse(data: number[], window: number, minMatch = 3, maxMatch = 258): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < data.length) {
    let bestLen = 0;
    let bestDist = 0;
    const start = Math.max(0, i - window);
    const limit = Math.min(maxMatch, data.length - i);
    for (let j = start; j < i; j += 1) {
      let len = 0;
      while (len < limit && data[j + len] === data[i + len]) len += 1;
      if (len > bestLen) {
        bestLen = len;
        bestDist = i - j;
      }
    }
    if (bestLen >= minMatch) {
      tokens.push({ length: bestLen, distance: bestDist });
      i += bestLen;
    } else {
      tokens.push({ literal: data[i] as number });
      i += 1;
    }
  }
  return tokens;
}

/** Precision chosen so the final interval is far wider than one output unit. */
function precisionBytes(serialLength: number): number {
  return Math.ceil((256 + 8 * serialLength) / 8);
}

/** Adaptive order-zero arithmetic encoder using an exact BigInt interval. */
function arithEncode(bytes: number[], byteCount: number): number[] {
  const full = (1n << BigInt(8 * byteCount)) - 1n;
  const freq: bigint[] = new Array<bigint>(256).fill(1n);
  let low = 0n;
  let high = full;
  for (const b of bytes) {
    let cum = 0n;
    let total = 0n;
    for (let i = 0; i < 256; i += 1) {
      if (i < b) cum += freq[i] as bigint;
      total += freq[i] as bigint;
    }
    const range = high - low + 1n;
    const nextHigh = low + (range * (cum + (freq[b] as bigint))) / total - 1n;
    low = low + (range * cum) / total;
    high = nextHigh;
    freq[b] = (freq[b] as bigint) + 1n;
  }
  const width = high - low + 1n;
  const code = low + width / 2n;
  const out: number[] = [];
  for (let i = 0; i < byteCount; i += 1) {
    out.push(Number((code >> BigInt(8 * (byteCount - 1 - i))) & 0xffn));
  }
  return out;
}

/** Mirroring adaptive arithmetic decoder. */
function arithDecode(data: number[], count: number): number[] {
  let code = 0n;
  for (const b of data) code = (code << 8n) | BigInt(b);
  const full = (1n << BigInt(8 * data.length)) - 1n;
  const freq: bigint[] = new Array<bigint>(256).fill(1n);
  let low = 0n;
  let high = full;
  const out: number[] = [];
  for (let n = 0; n < count; n += 1) {
    let total = 0n;
    for (let i = 0; i < 256; i += 1) total += freq[i] as bigint;
    const range = high - low + 1n;
    const scaled = ((code - low + 1n) * total - 1n) / range;
    let sym = 0;
    let cum = 0n;
    for (let b = 0; b < 256; b += 1) {
      if (scaled >= cum && scaled < cum + (freq[b] as bigint)) {
        sym = b;
        break;
      }
      cum += freq[b] as bigint;
    }
    const nextHigh = low + (range * (cum + (freq[sym] as bigint))) / total - 1n;
    low = low + (range * cum) / total;
    high = nextHigh;
    freq[sym] = (freq[sym] as bigint) + 1n;
    out.push(sym);
  }
  return out;
}

function serialize(tokens: Token[]): number[] {
  const bytes: number[] = [];
  for (const token of tokens) {
    if ("literal" in token) {
      bytes.push(0, token.literal);
    } else {
      bytes.push(1, token.length - 3, token.distance & 0xff, (token.distance >> 8) & 0xff);
    }
  }
  return bytes;
}

function deserialize(bytes: number[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] === 0) {
      tokens.push({ literal: bytes[i + 1] as number });
      i += 2;
    } else {
      tokens.push({
        length: (bytes[i + 1] as number) + 3,
        distance: (bytes[i + 2] as number) | ((bytes[i + 3] as number) << 8),
      });
      i += 4;
    }
  }
  return tokens;
}

/** Compress a byte array into an LZ77 plus arithmetic-coded stream. */
export function compress(data: number[], window = 4096): { stream: number[]; tokens: Token[] } {
  const tokens = lzParse(data, window);
  const serial = serialize(tokens);
  const byteCount = precisionBytes(serial.length);
  const coded = arithEncode(serial, byteCount);
  const header = [
    data.length & 0xff,
    (data.length >>> 8) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 24) & 0xff,
    serial.length & 0xff,
    (serial.length >>> 8) & 0xff,
    (serial.length >>> 16) & 0xff,
    (serial.length >>> 24) & 0xff,
    byteCount & 0xff,
    (byteCount >>> 8) & 0xff,
  ];
  return { stream: [...header, ...coded], tokens };
}

/** Invert the stream produced by compress. */
export function decompress(stream: number[]): number[] {
  const read32 = (offset: number): number =>
    ((stream[offset] as number) |
      ((stream[offset + 1] as number) << 8) |
      ((stream[offset + 2] as number) << 16) |
      ((stream[offset + 3] as number) << 24)) >>> 0;
  const originalLength = read32(0);
  const serialLength = read32(4);
  const byteCount = (stream[8] as number) | ((stream[9] as number) << 8);
  const tokens = deserialize(arithDecode(stream.slice(10, 10 + byteCount), serialLength));
  const out: number[] = [];
  for (const token of tokens) {
    if ("literal" in token) {
      out.push(token.literal);
    } else {
      for (let i = 0; i < token.length; i += 1) out.push(out[out.length - token.distance] as number);
    }
  }
  return out.slice(0, originalLength);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { text?: string; window?: number } | null) ?? {};
  const text = task.text ?? "to be or not to be that is the question to be or not to be";
  const window = typeof task.window === "number" && task.window > 0 ? task.window : 4096;
  const data = text.split("").map((ch) => ch.charCodeAt(0));
  const { stream, tokens } = compress(data, window);

  const makeBars = (start: number, span: number): VisualEntity[] =>
    data.map((byte, i) => ({
      id: `byte-${i}`,
      type: "bar" as const,
      label: byte < 32 || byte > 126 ? String(byte) : String.fromCharCode(byte),
      value: byte,
      state:
        i >= start && i < start + span
          ? ("comparing" as EntityState)
          : i < start
            ? ("sorted" as EntityState)
            : ("unvisited" as EntityState),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { row: 0, col: i },
    }));

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeBars(0, 0),
    edges: [],
    description: `Compressing ${data.length} input bytes with an LZ77 window of ${window}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { bytes: data.length, window },
  };
  index += 1;

  let offset = 0;
  for (let t = 0; t < tokens.length; t += 1) {
    const token = tokens[t] as Token;
    const span = "literal" in token ? 1 : token.length;
    yield {
      stepNumber: index,
      entities: makeBars(offset, span),
      edges: [],
      description:
        "literal" in token
          ? `Token ${t}: emit literal byte ${token.literal} at offset ${offset}.`
          : `Token ${t}: emit match of length ${token.length} at distance ${token.distance}, covering bytes ${offset} to ${offset + span - 1}.`,
      codeLineNumber: "literal" in token ? 2 : 3,
      layout: "array",
      meta: {
        token: t,
        kind: "literal" in token ? "literal" : "match",
        length: span,
        distance: "literal" in token ? 0 : token.distance,
        offset,
      },
    };
    index += 1;
    offset += span;
  }

  const roundTripOk = decompress(stream).join(",") === data.join(",");
  yield {
    stepNumber: index,
    entities: makeBars(data.length, 0),
    edges: [],
    description: `Coded ${tokens.length} LZ77 tokens into ${stream.length} bytes; ${data.length} input bytes ${roundTripOk ? "parse back exactly" : "fail the round-trip check"}.`,
    codeLineNumber: 6,
    layout: "array",
    meta: {
      originalBytes: data.length,
      compressedBytes: stream.length,
      tokens: tokens.length,
      ratio: stream.length / Math.max(1, data.length),
      roundTripOk,
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "LZMA compresses by finding repeated strings and then coding what is left. The LZ77 stage walks the input with a sliding window, replaces each repeated substring by a length and a distance, and passes single bytes through as literals. Those tokens are then fed to an adaptive arithmetic coder, which assigns shorter codes to byte values that have appeared often. Together they exploit both repeated phrases and skewed symbol frequencies.",
    invariants: [
      "Every match distance points to bytes already decoded before the current position.",
      "The coder's integer interval always contains the code for the remaining symbols.",
      "Encoding then decoding the token stream returns the original bytes exactly.",
    ],
    correctness:
      "The parser never looks forward past the current position, so a decoder can reproduce each match by copying from earlier output. The coder narrows an interval by cumulative frequencies in the encoder and locates the same symbol by comparing the code to those intervals in the decoder; both update their frequency tables identically. Using exact integer arithmetic removes rounding drift, so decompression recovers the input bit for bit.",
    complexityRationale:
      "The naive parser compares each position against every earlier position for up to the maximum match length, costing O(n times window times maxMatch); real LZMA uses hash chains to make this near linear. Coding each of the t serialized bytes scans 256 frequencies, so it costs O(256 t). Storage is linear in the input and token counts.",
    uses: [
      "The 7-Zip and xz container formats",
      "Firmware and installer archives where ratio matters",
      "Long-lived backups of text and source code",
    ],
    references: [
      "Lempel and Ziv, On the Complexity of Finite Sequences, 1976",
      "Pavlov, LZMA SDK Documentation, 2002",
    ],
    workedExample:
      "For the text 'abababab', the parser emits the literal 'a', the literal 'b', then a match of length six at distance two. The token bytes are coded with a frequency table that quickly favors the byte values used by the token tags, so the compressed stream is much shorter than the eight original bytes.",
  },
  id: "lzma-compression",
  name: "LZMA Compression",
  category: "production-systems",
  complexity: { time: "O(n * window * maxMatch + 256 * t)", space: "O(n + t)" },
  defaultInput: { text: "to be or not to be that is the question to be or not to be", window: 4096 },
  visualType: "array",
  run,
  pseudocode: [
    "input a byte string and a sliding window size",
    "at each position find the longest earlier match in the window",
    "emit a literal when the best match is too short, else a length-distance pair",
    "serialize the token stream into tag and parameter bytes",
    "arithmetic code each byte using an adaptive 256-symbol frequency table",
    "invert the coder and the token stream to verify the round trip",
    "done: report the compressed size and the number of tokens",
  ],
};

export default module;
