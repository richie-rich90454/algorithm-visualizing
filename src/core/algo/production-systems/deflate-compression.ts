/**
 * deflate-compression.ts - DEFLATE Compression (Small LZ77 + Huffman Simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DEFLATE combines LZ77 back-references with Huffman coding. The LZ77 stage
 * replaces repeated substrings with (length, distance) pairs that point back
 * into a sliding window; the Huffman stage assigns short bit strings to the
 * most frequent output symbols. This module performs both stages exactly on
 * a short text and reports the round-trip and bit counts.
 *
 * This is a small, exact teaching simulator: greedy longest-match LZ77 and an
 * optimal Huffman code over the emitted symbols. It is NOT a full RFC 1951
 * encoder: it does not emit the real DEFLATE bitstream, distance code trees,
 * dynamic block headers, or the length-code alphabet, and it is not intended
 * to interoperate with gzip or zlib.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * window * maxMatch) for LZ77 plus O(k log k) for Huffman
 *   Space: O(n + k) for the tokens, symbols, and codes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol in the text layout.
 *   - The current token is active; a matched source region is highlighted.
 *   - Edges join matched source characters to the current token.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Token {
    kind: "literal" | "ref";
    start: number;
    length: number;
    distance: number;
    symbol: number;
}

interface DeflateInput {
    text?: string;
    window?: number;
    minMatch?: number;
}

/** Greedy longest-match LZ77 parse over a sliding window. */
function lz77(text: string, window: number, minMatch: number, maxMatch: number): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
        let bestLength = 0;
        let bestDistance = 0;
        const start = Math.max(0, i - window);
        for (let j = start; j < i; j += 1) {
            let length = 0;
            while (length < maxMatch && i + length < text.length && text[j + length] === text[i + length]) {
                length += 1;
            }
            if (length > bestLength) {
                bestLength = length;
                bestDistance = i - j;
            }
        }
        if (bestLength >= minMatch) {
            tokens.push({ kind: "ref", start: i, length: bestLength, distance: bestDistance, symbol: 256 + (bestLength - 3) });
            i += bestLength;
        } else {
            tokens.push({ kind: "literal", start: i, length: 1, distance: 0, symbol: text.charCodeAt(i) });
            i += 1;
        }
    }
    return tokens;
}

/** Rebuild the text from an LZ77 token list, including overlapping copies. */
function decompress(tokens: Token[]): string {
    let output = "";
    for (const token of tokens) {
        if (token.kind === "literal") {
            output += String.fromCharCode(token.symbol);
        } else {
            const from = output.length - token.distance;
            for (let k = 0; k < token.length; k += 1) {
                output += output[from + k] ?? "";
            }
        }
    }
    return output;
}

interface HuffNode {
    frequency: number;
    symbol: number | null;
    left: HuffNode | null;
    right: HuffNode | null;
}

/** Optimal prefix-code lengths via Huffman's merge algorithm. */
function huffmanLengths(frequencies: Map<number, number>): Map<number, number> {
    const nodes: HuffNode[] = [...frequencies.entries()].map(([symbol, frequency]) => ({
        frequency,
        symbol,
        left: null,
        right: null,
    }));
    if (nodes.length === 0) {
        return new Map();
    }
    if (nodes.length === 1) {
        return new Map([[nodes[0]!.symbol!, 1]]);
    }
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.frequency - b.frequency);
        const a = nodes.shift()!;
        const b = nodes.shift()!;
        nodes.push({ frequency: a.frequency + b.frequency, symbol: null, left: a, right: b });
    }
    const lengths = new Map<number, number>();
    const walk = (node: HuffNode, depth: number): void => {
        if (node.symbol !== null) {
            lengths.set(node.symbol, depth);
            return;
        }
        if (node.left) {
            walk(node.left, depth + 1);
        }
        if (node.right) {
            walk(node.right, depth + 1);
        }
    };
    walk(nodes[0]!, 0);
    return lengths;
}

function makeEntities(text: string, token: Token | undefined): VisualEntity[] {
    return Array.from({ length: text.length }, (_, index) => {
        let state: EntityState = "idle";
        if (token && index >= token.start && index < token.start + token.length) {
            state = "active";
        } else if (token && token.kind === "ref" && index >= token.start - token.distance && index < token.start) {
            state = "comparing";
        }
        return {
            id: `char-${index}`,
            type: "character" as const,
            label: text[index] ?? "",
            value: text[index] ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k: index },
        };
    });
}

function makeEdges(token: Token | undefined): VisualEdge[] {
    if (!token || token.kind !== "ref") {
        return [];
    }
    const edges: VisualEdge[] = [];
    for (let k = 0; k < token.length; k += 1) {
        edges.push({
            id: `match-${token.start}-${k}`,
            sourceId: `char-${token.start - token.distance + k}`,
            targetId: `char-${token.start + k}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return edges;
}

/** The DEFLATE-style LZ77 + Huffman generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeflateInput | null) ?? {};
    const text = typeof task.text === "string" && task.text.length > 0
        ? task.text
        : "TOBEORNOTTOBEORTOBEORNOT";
    const window = typeof task.window === "number" ? Math.max(1, Math.floor(task.window)) : 32;
    const minMatch = typeof task.minMatch === "number" ? Math.max(2, Math.floor(task.minMatch)) : 3;
    const tokens = lz77(text, window, minMatch, 258);
    const restored = decompress(tokens);

    const frequencies = new Map<number, number>();
    for (const token of tokens) {
        frequencies.set(token.symbol, (frequencies.get(token.symbol) ?? 0) + 1);
    }
    const lengths = huffmanLengths(frequencies);
    const symbols = [...frequencies.keys()].sort((a, b) => a - b);
    const codeLengths = symbols.map((symbol) => lengths.get(symbol) ?? 0);
    const encodedBits = tokens.reduce((sum, token) => sum + (lengths.get(token.symbol) ?? 0), 0);
    const literalCount = tokens.filter((t) => t.kind === "literal").length;
    const refCount = tokens.length - literalCount;
    const note = "small DEFLATE-style simulator: greedy LZ77 plus Huffman, not a full RFC 1951 bitstream";

    yield {
        stepNumber: 0,
        entities: makeEntities(text, undefined),
        edges: [],
        description: `Parsing ${text.length} characters with a ${window}-character window; DEFLATE-style LZ77 plus Huffman teaching simulator.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {
            originalLength: text.length,
            rawBits: text.length * 8,
            tokenCount: tokens.length,
            literalCount,
            refCount,
            encodedBits,
            huffmanBits: encodedBits,
            totalBits: encodedBits,
            symbols,
            codeLengths,
            frequencies: symbols.map((s) => frequencies.get(s) ?? 0),
            tokenKinds: tokens.map((t) => (t.kind === "literal" ? 0 : 1)),
            tokenLengths: tokens.map((t) => t.length),
            tokenDistances: tokens.map((t) => t.distance),
            roundTrip: restored,
            note,
        },
    };

    let step = 1;
    for (const token of tokens) {
        yield {
            stepNumber: step,
            entities: makeEntities(text, token),
            edges: makeEdges(token),
            description: token.kind === "literal"
                ? `Token at ${token.start}: literal '${text[token.start] ?? ""}' emits one character.`
                : `Token at ${token.start}: copy ${token.length} characters from ${token.distance} positions back.`,
            codeLineNumber: token.kind === "literal" ? 2 : 3,
            layout: "text",
            meta: {
                originalLength: text.length,
                rawBits: text.length * 8,
                tokenCount: tokens.length,
                literalCount,
                refCount,
                encodedBits,
                huffmanBits: encodedBits,
                totalBits: encodedBits,
                symbols,
                codeLengths,
                frequencies: symbols.map((s) => frequencies.get(s) ?? 0),
                tokenKinds: tokens.map((t) => (t.kind === "literal" ? 0 : 1)),
                tokenLengths: tokens.map((t) => t.length),
                tokenDistances: tokens.map((t) => t.distance),
                roundTrip: restored,
                note,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(text, undefined),
        edges: [],
        description: `Huffman coding uses ${encodedBits} bits for ${tokens.length} token(s) versus ${text.length * 8} raw bits; round-trip ${restored === text ? "exact" : "FAILED"}.`,
        codeLineNumber: 5,
        layout: "text",
        meta: {
            originalLength: text.length,
            rawBits: text.length * 8,
            tokenCount: tokens.length,
            literalCount,
            refCount,
            encodedBits,
            huffmanBits: encodedBits,
            totalBits: encodedBits,
            symbols,
            codeLengths,
            frequencies: symbols.map((s) => frequencies.get(s) ?? 0),
            tokenKinds: tokens.map((t) => (t.kind === "literal" ? 0 : 1)),
            tokenLengths: tokens.map((t) => t.length),
            tokenDistances: tokens.map((t) => t.distance),
            roundTrip: restored,
            note,
        },
    };
}

/** The DEFLATE-style compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Compression first removes repetition, then removes wasted bits. The LZ77 pass scans for earlier copies of the upcoming text and writes a short back-reference instead of the repeated characters. The Huffman pass looks at the remaining symbols and gives the common ones short codes and the rare ones long codes. Together they shrink text without losing a single character.",
        invariants: [
            "Every back-reference points to an earlier position inside the sliding window.",
            "Decompressing the token stream reconstructs the input exactly, including overlaps.",
            "Huffman codes form a prefix-free set, so the bit string decodes uniquely.",
        ],
        correctness:
            "Greedy LZ77 emits at each position the longest match found in the window, or a literal when none qualifies; replaying literals and copies one character at a time reproduces the source by construction. Huffman's algorithm repeatedly merges the two least frequent symbols, which yields an optimal prefix code satisfying the Kraft equality. Because the code lengths come from that tree, the encoded stream is unambiguous.",
        complexityRationale:
            "For each of n positions the LZ77 scan compares up to window times maxMatch characters, giving O(n * window * maxMatch). Building the Huffman tree from k distinct symbols with a sorted merge takes O(k log k), and all token arrays are O(n + k) space.",
        uses: [
            "A teaching model for the compression stage behind gzip and zip files",
            "Explaining how repeated substrings become back-references",
            "Introducing entropy coding and prefix codes",
        ],
        references: [
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
            "Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952",
            "RFC 1951, DEFLATE Compressed Data Format Specification",
        ],
        workedExample:
            "On TOBEORTOBEOR the parser emits literals T, O, B, E, O, R, then a back-reference that copies several characters from earlier in the string. The resulting token symbols are counted; frequent ones such as O receive short Huffman codes, and decoding the tokens rebuilds the original text exactly.",
    },
    id: "deflate-compression",
    name: "DEFLATE Compression (Small LZ77 + Huffman Simulator)",
    category: "production-systems",
    complexity: { time: "O(n * window * maxMatch + k log k)", space: "O(n + k)" },
    defaultInput: { text: "TOBEORNOTTOBEORTOBEORNOT", window: 32, minMatch: 3 },
    visualType: "text",
    run,
    pseudocode: [
        "read the text, window size, and minimum match length",
        "scan each position for the longest earlier match",
        "emit a literal or a length-distance back-reference",
        "count the frequency of each emitted symbol",
        "build a Huffman tree and record code lengths",
        "replay the tokens to verify an exact round trip",
        "done: report tokens, codes, and bit counts",
    ],
};

export default module;
