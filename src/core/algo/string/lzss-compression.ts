/**
 * lzss-compression.ts - LZSS Sliding-Window Compression
 *
 * LZSS emits a stream of tokens: a literal character or a back-reference to a
 * repeated substring in the recent output. Unlike LZ77's fixed triples, a
 * literal costs no offset or length, so isolated characters stay cheap. The
 * decoder replays tokens and copies matches one character at a time, which
 * also permits matches that overlap the output being produced.
 *
 * Time: O(n * W * M) for text length n, window W, and match length bound M.
 * Space: O(n + W).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Token =
    | { literal: string }
    | { offset: number; length: number };

interface Task {
    text?: string;
    window?: number;
    minMatch?: number;
}

function encode(text: string, window: number, minMatch: number): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
        let bestLen = 0;
        let bestOff = 0;
        const start = Math.max(0, i - window);
        for (let j = start; j < i; j += 1) {
            let len = 0;
            while (i + len < text.length && text[j + len] === text[i + len]) len += 1;
            if (len > bestLen) {
                bestLen = len;
                bestOff = i - j;
            }
        }
        if (bestLen >= minMatch) {
            tokens.push({ offset: bestOff, length: bestLen });
            i += bestLen;
        } else {
            tokens.push({ literal: text[i] ?? "" });
            i += 1;
        }
    }
    return tokens;
}

function decode(tokens: Token[]): string {
    let out = "";
    for (const token of tokens) {
        if ("literal" in token) {
            out += token.literal;
        } else {
            for (let k = 0; k < token.length; k += 1) {
                out += out[out.length - token.offset] ?? "";
            }
        }
    }
    return out;
}

function describe(token: Token): string {
    return "literal" in token ? `L'${token.literal}'` : `M(${token.offset},${token.length})`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const text =
        typeof task.text === "string" && task.text.length > 0
            ? task.text.slice(0, 40)
            : "abracadabraabracadabra";
    const window = Math.min(32, Math.max(1, Math.floor(typeof task.window === "number" ? task.window : 8)));
    const minMatch = Math.min(4, Math.max(2, Math.floor(typeof task.minMatch === "number" ? task.minMatch : 2)));
    const tokens = encode(text, window, minMatch);
    const roundTrip = decode(tokens) === text;
    let consumed = 0;
    let step = 0;

    const frame = (desc: string, line: number, shownTokens: number): VisualFrame => {
        const entities: VisualEntity[] = [...text].map((ch, i) => ({
            id: `ch-${i}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: (i < consumed ? "visited" : i === consumed ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        let literals = 0;
        let matches = 0;
        for (let t = 0; t < shownTokens && t < tokens.length; t += 1) {
            const token = tokens[t];
            if (token && "literal" in token) literals += 1;
            else matches += 1;
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 7),
            layout: "text",
            meta: {
                window,
                minMatch,
                tokenCount: tokens.length,
                literals,
                matches,
                roundTrip,
                tokens: tokens.slice(0, shownTokens).map(describe),
            },
        };
    };
    yield frame(
        `LZSS over "${text}" with window ${window}; a match must repeat at least ${minMatch} characters.`,
        0,
        0,
    );
    step += 1;

    for (let t = 0; t < tokens.length; t += 1) {
        const token = tokens[t];
        if (!token) continue;
        consumed += "literal" in token ? 1 : token.length;
        yield frame(`Token ${t + 1}: ${describe(token)} emitted for text from position ${consumed - ("literal" in token ? 1 : token.length)}.`, 3, t + 1);
        step += 1;
    }

    yield frame(
        `Done: ${tokens.length} token(s) encode ${text.length} characters; decode matches input: ${roundTrip}.`,
        7,
        tokens.length,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Scan the text from left to right and look back only a short window. If the current substring also appeared recently, write a short pointer made of an offset and a length instead of the characters themselves; otherwise write the single character as a literal. A decoder walks the tokens in order and copies each match out of the text it has already rebuilt.",
        invariants: [
            "Every match offset is between 1 and the window size and never exceeds the decoded output produced so far.",
            "A match is emitted only when its length reaches the minimum, so literals stay cheaper for isolated characters.",
            "Decoding all emitted tokens reproduces the original text exactly.",
        ],
        correctness:
            "A literal directly contributes its character. A match reads characters already present in the decoder output at a fixed distance behind the current end, so copying them one at a time is well defined even when the copy overlaps itself, and the number of characters copied equals the match length. The encoder advances the input pointer by exactly the number of input characters each token represents, so the tokens cover the whole input in order. By induction over tokens the decoded output equals the input, which the demo confirms with a round trip.",
        complexityRationale:
            "At each of n positions the encoder checks at most W offsets and compares up to the match length, bounded by the remaining text, giving O(n * W * M) time. The token list holds at most n entries and the window is W, so space is O(n + W).",
        uses: [
            "The LZSS family behind many dictionary compressors",
            "Storage and network formats that favor fast decoding",
            "A teaching contrast with fixed-triple LZ77 and dictionary LZW",
        ],
        references: [
            "Storer and Szymanski, Data Compression via Textual Substitution, Journal of the ACM, 1982",
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
        ],
        workedExample:
            "For 'aaaab' with window 4 and minimum match 2, the encoder writes the literal 'a', then a match (1,3) that copies three more 'a' characters from one position back, then the literal 'b'. Replaying the three tokens rebuilds 'aaaab' exactly.",
    },
    id: "lzss-compression",
    name: "LZSS Compression",
    category: "string",
    complexity: { time: "O(n * W * M)", space: "O(n + W)" },
    defaultInput: { text: "abracadabraabracadabra", window: 8, minMatch: 2 },
    visualType: "text",
    run,
    pseudocode: [
        "read the text, window size W and minimum match length",
        "set position i to zero and create an empty token list",
        "search the last W characters for the longest match of text at i",
        "if the match length reaches the minimum",
        "emit a match token with its offset and length and advance i by its length",
        "otherwise emit a literal for text[i] and advance i by one",
        "decode by appending literals and copying matches character by character",
        "report the token list and confirm the decoded text matches the input",
    ],
};

export default module;
