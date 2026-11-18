/**
 * lz4-compression.ts - LZ4-Style Match Compression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LZ4 is a fast byte-oriented compressor built on an LZ77 match finder. It
 * keeps a table mapping each four-byte sequence to the most recent position
 * where it occurred. At each position it looks up the current four bytes; when
 * a recent match exists it emits a short (offset, length) reference instead of
 * copying the bytes, otherwise it emits a literal. Repeating data compresses
 * well, and the decoder reproduces the input exactly by copying from the
 * already-decoded output at the given offset.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) average for n input symbols
 *   Space: O(n) for the table, tokens, and displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character per input symbol, shown in text layout.
 *   - The current position is highlighted; a matched span is marked as a path.
 *   - meta carries the emitted token stream for lossless reconstruction checks.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Match {
    match: true;
    offset: number;
    length: number;
}

interface Literal {
    match: false;
    char: string;
}

type Token = Match | Literal;

/** Build the character entities with per-symbol states. */
function makeChars(
    text: string,
    consumed: number,
    matchStart: number,
    matchLength: number,
    done: boolean,
): VisualEntity[] {
    return [...text].map((char, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (matchLength > 0 && index >= matchStart && index < matchStart + matchLength) {
            state = "path";
        } else if (index === consumed) {
            state = "comparing";
        } else if (index < consumed) {
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

/** The LZ4-style compression generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; minMatch?: number } | null) ?? {};
    const text = typeof task.text === "string" && task.text.length > 0
        ? task.text
        : "abcabcabcabcabcabc";
    const chars = [...text];
    const n = chars.length;
    const minMatch = Math.min(8, Math.max(3, Math.floor(Number(task.minMatch ?? 4)) || 4));
    const maxMatch = 255;
    const table = new Map<string, number>();
    const tokens: Token[] = [];
    let literals = 0;
    let matches = 0;
    let encodedSize = 0;

    const tokenStrings = (): string[] => tokens.map((token) => token.match
        ? `M:${token.offset}:${token.length}`
        : `L:${token.char}`);

    const buildMeta = (phase: string, position: number, matchStart: number, matchLength: number) => ({
        phase,
        text,
        length: n,
        minMatch,
        tokens: tokenStrings(),
        tokenCount: tokens.length,
        literalCount: literals,
        matchCount: matches,
        originalSize: n,
        encodedSize,
        position,
        matchStart,
        matchLength,
    });

    yield {
        stepNumber: 0,
        entities: makeChars(text, 0, -1, 0, false),
        edges: [],
        description: `Compressing ${n} symbol(s) with an LZ4-style four-symbol match finder (minimum match ${minMatch}).`,
        codeLineNumber: 0,
        layout: "text",
        meta: buildMeta("setup", 0, -1, 0),
    };
    let step = 1;

    let i = 0;
    while (i < n) {
        let matched = false;
        if (i + minMatch <= n) {
            const key = chars.slice(i, i + minMatch).join("");
            const previous = table.get(key);
            if (previous !== undefined && previous < i && i - previous <= 65535) {
                let length = minMatch;
                while (i + length < n && chars[previous + length] === chars[i + length]) {
                    length += 1;
                }
                length = Math.min(length, maxMatch);
                const offset = i - previous;
                tokens.push({ match: true, offset, length });
                matches += 1;
                encodedSize += 3;
                for (let k = 0; k < length; k += 1) {
                    if (i + k + minMatch <= n) {
                        table.set(chars.slice(i + k, i + k + minMatch).join(""), i + k);
                    }
                }
                yield {
                    stepNumber: step,
                    entities: makeChars(text, i, i, length, false),
                    edges: [],
                    description: `Match at position ${i}: copy ${length} symbol(s) from ${offset} position(s) back instead of storing literals.`,
                    codeLineNumber: 3,
                    layout: "text",
                    meta: buildMeta("match", i, i, length),
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
        const char = chars[i] ?? "";
        tokens.push({ match: false, char });
        literals += 1;
        encodedSize += 1;
        yield {
            stepNumber: step,
            entities: makeChars(text, i, -1, 0, false),
            edges: [],
            description: `Literal at position ${i}: emit '${char}'.`,
            codeLineNumber: 5,
            layout: "text",
            meta: buildMeta("literal", i, -1, 0),
        };
        step += 1;
        i += 1;
    }

    yield {
        stepNumber: step,
        entities: makeChars(text, n, -1, 0, true),
        edges: [],
        description: `Compressed ${n} symbol(s) into ${tokens.length} token(s): ${literals} literal(s), ${matches} match(es). Decoding reproduces the input exactly.`,
        codeLineNumber: 6,
        layout: "text",
        meta: buildMeta("done", n, -1, 0),
    };
}

/** The LZ4-style compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of writing the same bytes again, remember where you saw them and write a pointer back. LZ4 remembers the last place each four-byte pattern occurred. When the pattern reappears, it records an offset and a length, which is often fewer bytes than the original text, and the decoder follows those pointers to rebuild the data.",
        invariants: [
            "The table maps each four-symbol key to its most recent earlier position.",
            "Every emitted match has a positive offset within the search window.",
            "Concatenating literals and expanded matches reproduces the input exactly.",
        ],
        correctness:
            "At a match, the encoder verifies symbol-by-symbol that the source at the stored offset agrees with the current position for the whole reported length, so a decoder copying that many symbols from offset positions back writes identical symbols. Literals are emitted verbatim. By induction over the token stream, the decoder's output after each token equals the encoder's prefix of the input, so the full token stream is lossless. Using the most recent occurrence keeps the offset small and the encoding compact without affecting correctness.",
        complexityRationale:
            "Each position performs one hash-table lookup and constant work per emitted or extended symbol, giving average O(n) time and O(n) space for the table and token list.",
        uses: [
            "Fast general-purpose block compression",
            "On-the-fly compression in databases and file systems",
            "Reducing network payloads where decode speed matters",
        ],
        references: [
            "Collet, LZ4 Compression Algorithm, reference implementation and format specification",
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
        ],
        workedExample:
            "Compressing abcabcabcabcabcabc, the first four symbols are emitted as literals. At position four the key abca points back four symbols, and the match extends to fourteen symbols, so a single (offset 4, length 14) token replaces the rest, far shorter than storing the repeating text.",
    },
    id: "lz4-compression",
    name: "LZ4-Style Compression",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "abcabcabcabcabcabc", minMatch: 4 },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty hash table of four-symbol keys",
        "for each position in the input",
        "look up the current four-symbol key in the table",
        "if a recent earlier position exists, emit an offset and length match",
        "otherwise emit the current symbol as a literal",
        "record the current position for the four-symbol key",
        "done: report the token stream and its encoded size",
    ],
};

export default module;
