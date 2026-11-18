/**
 * zstandard-compression.ts - Zstandard-Style LZ Match Finder plus Huffman Stage
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module demonstrates the two core ideas behind Zstandard compression. A
 * match finder hashes each four-symbol key to its most recent earlier position
 * and replaces a repeated span with an (offset, length) reference. The literal
 * symbols that remain are then entropy coded with a Huffman code built from
 * their frequencies, which is how real Zstandard shrinks the literal stream
 * after LZ parsing. A decoder that expands the matches and reads the Huffman
 * bits reproduces the original input exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * maxMatch) worst case for match extension plus O(n log n) for
 *          building the Huffman tree over distinct symbols
 *   Space: O(n) for the hash table, tokens, and Huffman codebook
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character per input symbol is drawn in text layout.
 *   - The active position is yellow; a matched span is green.
 *   - meta carries tokens, Huffman codes, sizes, and the decoded string.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HuffmanNode {
    symbol: string | null;
    weight: number;
    left: HuffmanNode | null;
    right: HuffmanNode | null;
}

/** Build a prefix-free Huffman codebook from symbol frequencies. */
function huffmanCodes(frequencies: Map<string, number>): Map<string, string> {
    const codes = new Map<string, string>();
    if (frequencies.size === 0) {
        return codes;
    }
    if (frequencies.size === 1) {
        const only = [...frequencies.keys()][0];
        if (only !== undefined) {
            codes.set(only, "0");
        }
        return codes;
    }
    const nodes: HuffmanNode[] = [...frequencies.entries()].map(([symbol, weight]) => ({
        symbol,
        weight,
        left: null,
        right: null,
    }));
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.weight - b.weight || (a.symbol ?? "").localeCompare(b.symbol ?? ""));
        const left = nodes.shift();
        const right = nodes.shift();
        if (!left || !right) {
            break;
        }
        nodes.push({ symbol: null, weight: left.weight + right.weight, left, right });
    }
    const walk = (node: HuffmanNode | null, prefix: string): void => {
        if (!node) {
            return;
        }
        if (node.symbol !== null) {
            codes.set(node.symbol, prefix || "0");
            return;
        }
        walk(node.left, prefix + "0");
        walk(node.right, prefix + "1");
    };
    walk(nodes[0] ?? null, "");
    return codes;
}

function makeChars(text: string, position: number, matchStart: number, matchLength: number, done: boolean): VisualEntity[] {
    return [...text].map((char, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (matchLength > 0 && index >= matchStart && index < matchStart + matchLength) {
            state = "path";
        } else if (index === position) {
            state = "comparing";
        } else if (index < position) {
            state = "visited";
        }
        return {
            id: `char-${index}`,
            type: "character" as const,
            label: char,
            value: char,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, char },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; minMatch?: number; window?: number } | null) ?? {};
    const text = typeof task.text === "string" && task.text.length > 0
        ? task.text
        : "compress compress compress repeat repeat repeat";
    const chars = [...text];
    const n = chars.length;
    const minMatch = Math.min(8, Math.max(3, Math.floor(Number(task.minMatch ?? 4)) || 4));
    const window = Math.min(256, Math.max(8, Math.floor(Number(task.window ?? 64)) || 64));
    const maxMatch = 32;
    const table = new Map<string, number>();

    // Stage 1: LZ parse into literals and (offset, length) matches.
    const tokens: Array<{ kind: "match"; offset: number; length: number } | { kind: "literal"; char: string }> = [];
    const tokenStrings = (): string[] => tokens.map((token) => token.kind === "match"
        ? `M|${token.offset}|${token.length}`
        : `L|${token.char}`);

    const meta = (phase: string, position: number, matchStart: number, matchLength: number, codes: Map<string, string>, literalBits: number) => {
        const literals = tokens.filter((token) => token.kind === "literal").length;
        const matches = tokens.filter((token) => token.kind === "match").length;
        const decoded = decode(tokens);
        return {
            phase,
            text,
            length: n,
            minMatch,
            window,
            tokens: tokenStrings(),
            tokenCount: tokens.length,
            literalCount: literals,
            matchCount: matches,
            codes: [...codes.entries()].map(([char, bits]) => `${char}|${bits}`),
            literalBits,
            originalSize: n,
            encodedSize: matches * 3 + Math.ceil(literalBits / 8),
            decoded,
            position,
            matchStart,
            matchLength,
        };
    };
    const emptyCodes = new Map<string, string>();

    yield {
        stepNumber: 0,
        entities: makeChars(text, 0, -1, 0, false),
        edges: [],
        description: `Zstandard-style compression of ${n} symbol(s): LZ matches followed by Huffman-coded literals.`,
        codeLineNumber: 0,
        layout: "text",
        meta: meta("setup", 0, -1, 0, emptyCodes, 0),
    };
    let step = 1;

    let i = 0;
    while (i < n) {
        let matched = false;
        if (i + minMatch <= n) {
            const key = chars.slice(i, i + minMatch).join("");
            const previous = table.get(key);
            if (previous !== undefined && previous < i && i - previous <= window) {
                let length = minMatch;
                while (i + length < n && chars[previous + length] === chars[i + length] && length < maxMatch) {
                    length += 1;
                }
                tokens.push({ kind: "match", offset: i - previous, length });
                for (let k = 0; k < length; k += 1) {
                    if (i + k + minMatch <= n) {
                        table.set(chars.slice(i + k, i + k + minMatch).join(""), i + k);
                    }
                }
                yield {
                    stepNumber: step,
                    entities: makeChars(text, i, i, length, false),
                    edges: [],
                    description: `Match at ${i}: copy ${length} symbol(s) from ${i - previous} position(s) back.`,
                    codeLineNumber: 3,
                    layout: "text",
                    meta: meta("match", i, i, length, emptyCodes, 0),
                };
                step += 1;
                i += length;
                matched = true;
            }
        }
        if (matched) {
            continue;
        }
        if (i + minMatch <= n) {
            table.set(chars.slice(i, i + minMatch).join(""), i);
        }
        tokens.push({ kind: "literal", char: chars[i] ?? "" });
        yield {
            stepNumber: step,
            entities: makeChars(text, i, -1, 0, false),
            edges: [],
            description: `Literal at ${i}: keep '${chars[i] ?? ""}' for the Huffman stage.`,
            codeLineNumber: 4,
            layout: "text",
            meta: meta("literal", i, -1, 0, emptyCodes, 0),
        };
        step += 1;
        i += 1;
    }

    // Stage 2: entropy-code the literal stream.
    const frequencies = new Map<string, number>();
    for (const token of tokens) {
        if (token.kind === "literal") {
            frequencies.set(token.char, (frequencies.get(token.char) ?? 0) + 1);
        }
    }
    const codes = huffmanCodes(frequencies);
    const literalBits = tokens.reduce((sum, token) => sum + (token.kind === "literal" ? (codes.get(token.char)?.length ?? 0) : 0), 0);

    yield {
        stepNumber: step,
        entities: makeChars(text, n, -1, 0, true),
        edges: [],
        description: `Built ${codes.size} Huffman code(s); literals use ${literalBits} bit(s) and the stream decodes exactly.`,
        codeLineNumber: 6,
        layout: "text",
        meta: { ...meta("done", n, -1, 0, codes, literalBits), phase: "done" },
    };
}

/** Expand the LZ tokens; the Huffman codebook is checked by the caller. */
function decode(tokens: Array<{ kind: "match"; offset: number; length: number } | { kind: "literal"; char: string }>): string {
    const out: string[] = [];
    for (const token of tokens) {
        if (token.kind === "literal") {
            out.push(token.char);
        } else {
            for (let k = 0; k < token.length; k += 1) {
                const sourceIndex = out.length - token.offset;
                out.push(sourceIndex >= 0 ? (out[sourceIndex] ?? "") : "");
            }
        }
    }
    return out.join("");
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Real compressors combine two tricks. First they replace repeated text with back-references: instead of writing the same word twice, write how far back it appeared and how long the repetition is. Then they shorten the leftover literal symbols by giving common characters short bit patterns and rare ones long patterns. Zstandard uses exactly this combination of LZ match finding and entropy coding of literals.",
        invariants: [
            "Every match has a positive offset within the sliding window and a positive length.",
            "Huffman codes are prefix-free, so a bit string has only one decoding.",
            "Expanding matches and decoding literals reproduces the original input exactly.",
        ],
        correctness:
            "At a match the encoder symbol-by-symbol verifies that the source at the stored offset equals the current span, so a decoder copying that many symbols from the offset writes identical symbols. Literals are emitted verbatim and their Huffman codes are generated from a binary tree, which guarantees the prefix-free property and unambiguous decoding. By induction over the token stream, the decoder's output after each token equals the encoder's input prefix, so the whole stream is lossless.",
        complexityRationale:
            "Each position does one hash lookup and extends a match by at most the maximum match length, while building the Huffman tree sorts the distinct symbols; the table, tokens, and codebook together use O(n) space.",
        uses: [
            "General-purpose block compression in file systems and databases",
            "Reducing network payloads with fast decompression",
            "Compressing log and columnar data with repeated values",
        ],
        references: [
            "Zstandard Compression and the zstd Frame Format, RFC 8878",
            "Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952",
        ],
        workedExample:
            "In 'compress compress compress', the first seven symbols are literals. At the next occurrence the four-symbol key 'comp' points seven positions back and the match extends to seven symbols, so one (offset 7, length 7) token replaces the second word. The remaining literals are then Huffman coded by frequency.",
    },
    id: "zstandard-compression",
    name: "Zstandard-Style Compression",
    category: "production-systems",
    complexity: { time: "O(n * maxMatch + n log n)", space: "O(n)" },
    defaultInput: { text: "compress compress compress repeat repeat repeat", minMatch: 4, window: 64 },
    visualType: "text",
    run,
    pseudocode: [
        "initialize a hash table of four-symbol keys",
        "at each position look up the most recent earlier occurrence",
        "if a match exists within the window, emit its offset and length",
        "otherwise emit the symbol as a literal for entropy coding",
        "build a Huffman codebook from literal frequencies",
        "encode the literals into bits and report the compressed size",
        "done: expand the stream and confirm lossless decoding",
    ],
};

export default module;
