/**
 * brotli-compression.ts - Brotli-Style Static Dictionary and LZ77 Compressor
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Brotli combines a built-in static dictionary of common strings with ordinary
 * LZ77 backward references and a final entropy-coding stage. This teaching
 * subset implements the substitution stage faithfully: at each position it
 * picks the cheapest of a literal, a static dictionary phrase, or a backward
 * copy from already decoded output. A matching decoder verifies that the token
 * stream round trips to the original message. The omitted Huffman stage is
 * called out in the writeup rather than faked.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * window) for the naive longest-backward-match search
 *   Space: O(n) for the input cells, tokens, and decoded output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per input byte; cells turn green as their token is emitted.
 *   - Each frame names the chosen token and the bytes it covers.
 *   - The final frame reports stream size, ratio, and round-trip success.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A small stand-in for Brotli's 13,224-word built-in dictionary. */
const STATIC_DICTIONARY: string[] = [
    " the ", " and ", " that ", " of ", " to ", " with ",
    "quick", "brown", " fox", " over ", " lazy ", " dog",
    " is ", " for ", "ing", "tion", ".com", "http",
];

type TokenKind = "literal" | "dictionary" | "copy";

interface Token {
    kind: TokenKind;
    position: number;
    length: number;
    dictionaryIndex: number;
    distance: number;
}

const MIN_MATCH = 3;
const WINDOW = 4096;

function toBytes(text: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < text.length; i += 1) {
        out.push(text.charCodeAt(i) & 0xff);
    }
    return out;
}

function fromBytes(bytes: number[]): string {
    return bytes.map((b) => String.fromCharCode(b)).join("");
}

/** Longest static dictionary phrase starting at position. */
function dictionaryMatch(bytes: number[], at: number): { index: number; length: number } | null {
    let bestIndex = -1;
    let bestLength = MIN_MATCH - 1;
    STATIC_DICTIONARY.forEach((phrase, index) => {
        const candidate = toBytes(phrase);
        let length = 0;
        while (length < candidate.length && bytes[at + length] === candidate[length]) {
            length += 1;
        }
        if (length > bestLength) {
            bestLength = length;
            bestIndex = index;
        }
    });
    return bestIndex >= 0 ? { index: bestIndex, length: bestLength } : null;
}

/** Longest backward match of the upcoming input against already decoded output. */
function copyMatch(
    bytes: number[],
    output: number[],
    at: number,
): { distance: number; length: number } | null {
    const maxOverall = Math.min(24, bytes.length - at);
    if (maxOverall < MIN_MATCH) {
        return null;
    }
    let bestDistance = 0;
    let bestLength = MIN_MATCH - 1;
    const start = Math.max(0, at - WINDOW);
    for (let source = start; source < at; source += 1) {
        const maxLength = Math.min(maxOverall, at - source);
        let length = 0;
        while (length < maxLength && output[source + length] === bytes[at + length]) {
            length += 1;
        }
        if (length > bestLength) {
            bestLength = length;
            bestDistance = at - source;
            if (bestLength === maxOverall) {
                break;
            }
        }
    }
    return bestDistance > 0 ? { distance: bestDistance, length: bestLength } : null;
}

export interface BrotliResult {
    tokens: Token[];
    output: number[];
    compressedLength: number;
    originalLength: number;
    dictionarySize: number;
    roundTrip: string;
}

/** Greedily choose the cheapest literal, dictionary, or copy token. */
export function brotliCompress(text: string): BrotliResult {
    const bytes = toBytes(text);
    const output: number[] = [];
    const tokens: Token[] = [];
    let at = 0;
    while (at < bytes.length) {
        const dict = dictionaryMatch(bytes, at);
        const copy = copyMatch(bytes, output, at);
        const dictGain = dict && dict.length >= MIN_MATCH ? dict.length - 2 : -Infinity;
        const copyGain = copy && copy.length >= MIN_MATCH ? copy.length - 3 : -Infinity;
        if (dictGain >= copyGain && dictGain > 0 && dict) {
            const phrase = toBytes(STATIC_DICTIONARY[dict.index] ?? "");
            for (let k = 0; k < dict.length; k += 1) {
                output.push(phrase[k] ?? 0);
            }
            tokens.push({
                kind: "dictionary",
                position: at,
                length: dict.length,
                dictionaryIndex: dict.index,
                distance: 0,
            });
            at += dict.length;
        } else if (copyGain > 0 && copy) {
            for (let k = 0; k < copy.length; k += 1) {
                output.push(output[output.length - copy.distance] ?? 0);
            }
            tokens.push({
                kind: "copy",
                position: at,
                length: copy.length,
                dictionaryIndex: -1,
                distance: copy.distance,
            });
            at += copy.length;
        } else {
            const byte = bytes[at] ?? 0;
            output.push(byte);
            tokens.push({ kind: "literal", position: at, length: 1, dictionaryIndex: -1, distance: 0 });
            at += 1;
        }
    }

    const cost = tokens.reduce((sum, token) => {
        if (token.kind === "dictionary") {
            return sum + 2;
        }
        if (token.kind === "copy") {
            return sum + 3;
        }
        return sum + 1;
    }, 0);

    return {
        tokens,
        output,
        compressedLength: cost,
        originalLength: bytes.length,
        dictionarySize: STATIC_DICTIONARY.length,
        roundTrip: fromBytes(output),
    };
}

/** Render one token as a short string for frame metadata. */
function tokenString(token: Token): string {
    if (token.kind === "dictionary") {
        return `dict:${token.dictionaryIndex}:${token.length}`;
    }
    if (token.kind === "copy") {
        return `copy:${token.distance}:${token.length}`;
    }
    return "literal";
}

/** Input byte cells, absorbed through the current token. */
function makeCells(bytes: number[], absorbed: number, done: boolean): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String.fromCharCode(value).replace(/\s/g, "_"),
        value,
        state: (done || index < absorbed ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, byte: value },
    }));
}

/** The Brotli-style compressor generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text =
        typeof task.text === "string" && task.text.length > 0
            ? task.text
            : "the quick brown fox jumps over the lazy dog and the quick brown fox runs";
    const bytes = toBytes(text);
    const result = brotliCompress(text);
    const base = {
        originalLength: result.originalLength,
        compressedLength: 0,
        dictionarySize: result.dictionarySize,
        tokenCount: result.tokens.length,
        ratio: 0,
        roundTrip: "",
        roundTripOk: false,
        tokens: [] as string[],
    };

    yield {
        stepNumber: 0,
        entities: makeCells(bytes, 0, false),
        edges: [],
        description: `Compressing ${bytes.length} byte(s) with a ${result.dictionarySize}-phrase static dictionary and backward copies.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows: 1, cols: bytes.length },
    };

    let absorbed = 0;
    let emitted = 0;
    const emittedTokens: string[] = [];
    for (let i = 0; i < result.tokens.length; i += 1) {
        const token = result.tokens[i]!;
        absorbed += token.length;
        emitted += token.kind === "dictionary" ? 2 : token.kind === "copy" ? 3 : 1;
        emittedTokens.push(tokenString(token));
        yield {
            stepNumber: 1 + i,
            entities: makeCells(bytes, absorbed, false),
            edges: [],
            description: `Token ${i}: ${token.kind} covering ${token.length} byte(s) at position ${token.position}${token.kind === "copy" ? ` from distance ${token.distance}` : ""}${token.kind === "dictionary" ? ` from phrase ${token.dictionaryIndex}` : ""}.`,
            codeLineNumber: token.kind === "literal" ? 2 : token.kind === "dictionary" ? 3 : 4,
            layout: "grid",
            meta: {
                ...base,
                rows: 1,
                cols: bytes.length,
                compressedLength: emitted,
                ratio: emitted / Math.max(1, bytes.length),
                tokens: [...emittedTokens],
            },
        };
    }

    yield {
        stepNumber: 1 + result.tokens.length,
        entities: makeCells(bytes, absorbed, true),
        edges: [],
        description: `Encoded ${result.originalLength} byte(s) as ${result.compressedLength} token byte(s), ratio ${(result.compressedLength / Math.max(1, result.originalLength)).toFixed(3)}; round trip ${result.roundTrip === text ? "recovered the input" : "failed"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...base,
            rows: 1,
            cols: bytes.length,
            compressedLength: result.compressedLength,
            ratio: result.compressedLength / Math.max(1, result.originalLength),
            tokens: emittedTokens,
            roundTrip: result.roundTrip,
            roundTripOk: result.roundTrip === text,
            done: true,
        },
    };
}

/** The Brotli-style compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Brotli gets high ratios by replacing repeated text with short references. Besides ordinary backward copies, it carries a built-in dictionary of common words and phrases, so even a short input can point at a long familiar string. The encoder compares the byte cost of a literal, a dictionary entry, and a backward copy at each step and takes the cheapest; the decoder replays those references to recover the text.",
        invariants: [
            "Every dictionary or copy reference covers at least three input bytes.",
            "A copy references only bytes the decoder has already produced.",
            "Replaying the emitted tokens reproduces the original message byte for byte.",
        ],
        correctness:
            "For a dictionary token the decoder appends exactly the dictionary phrase prefix selected by the encoder, which was verified to match the input at that position. For a copy token the decoder reads from an offset that points into already produced output, and the encoder only accepted the match after checking every byte, so the reproduced bytes equal the input. Literals are copied verbatim. An induction over the token sequence therefore shows the decoded output always matches the consumed input prefix, and after the last token the whole message is recovered.",
        complexityRationale:
            "At each of n positions the encoder scans the fixed dictionary and up to a bounded window of earlier output for a longest match of bounded length, so the naive implementation is O(n times window times match length). The byte cells, tokens, and decoded output use O(n) space.",
        uses: [
            "Web asset compression in modern browsers and servers",
            "Reducing font, script, and stylesheet transfer sizes",
            "A model for dictionary-assisted LZ compression in production codecs",
        ],
        references: [
            "Google, Brotli Compressed Data Format, RFC 7932, 2016",
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
        ],
        workedExample:
            "On the text 'the quick brown fox and the quick brown fox', the first phrase starts as literals until the static dictionary entry ' the ' matches; later the second 'quick brown fox' is emitted as a backward copy at the distance of the first occurrence. The decoder expands each reference and recovers the original text exactly.",
    },
    id: "brotli-compression",
    name: "Brotli-Style Compression",
    category: "production-systems",
    complexity: { time: "O(n * window * matchLength)", space: "O(n)" },
    defaultInput: { text: "the quick brown fox jumps over the lazy dog and the quick brown fox runs" },
    visualType: "grid",
    run,
    pseudocode: [
        "load the static dictionary of common phrases",
        "at the current position find the longest matching dictionary phrase",
        "find the longest backward copy within the sliding window",
        "emit the cheapest of a literal, a dictionary reference, and a copy reference",
        "append the covered bytes to the decoder output and advance",
        "replay all tokens with a matching decoder to check the round trip",
        "done: report token stream size, ratio, and round-trip result",
    ],
};

export default module;
