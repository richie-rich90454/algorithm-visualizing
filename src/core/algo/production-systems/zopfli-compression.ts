/**
 * zopfli-compression.ts - Optimal LZ77 Parse (Zopfli-Style)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This teaching toy captures the core idea of Zopfli: instead of greedily
 * taking the longest match, search all match lengths at every position and use
 * dynamic programming to minimize the total bit cost of the LZ77 token stream.
 * The resulting token sequence decodes back to the original bytes and never
 * costs more than a greedy longest-match parse under the same cost model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * maxMatch) for the naive backward match search
 *   Space: O(n) for the dynamic-programming table and token choices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the cumulative bit cost after each emitted token.
 *   - Literal and match tokens are distinguished in frame metadata.
 *   - The final frame compares the optimal cost with the greedy cost.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const LITERAL_COST = 9;
const MATCH_COST = 12;
const MIN_MATCH = 3;
const MAX_MATCH = 32;

type Token =
    | { type: "literal"; char: string; cost: number }
    | { type: "match"; length: number; distance: number; cost: number };

/** Number of bits needed to hold a positive integer. */
function bitLength(value: number): number {
    if (value <= 0) return 0;
    return Math.floor(Math.log2(value)) + 1;
}

/** Bit cost of a match of the given length and distance. */
function matchCost(length: number, distance: number): number {
    return MATCH_COST + bitLength(length) + bitLength(distance);
}

/** Most recent earlier start of a substring, or -1 when absent. */
function findPrevious(bytes: number[], start: number, length: number): number {
    for (let j = start - 1; j >= 0; j -= 1) {
        let matched = true;
        for (let k = 0; k < length; k += 1) {
            if (bytes[j + k] !== bytes[start + k]) {
                matched = false;
                break;
            }
        }
        if (matched) return j;
    }
    return -1;
}

/** Greedy longest-match parse used as the comparison baseline. */
function greedyTokens(bytes: number[]): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < bytes.length) {
        let bestLength = 0;
        let bestDistance = 0;
        const limit = Math.min(MAX_MATCH, bytes.length - i);
        for (let length = MIN_MATCH; length <= limit; length += 1) {
            const position = findPrevious(bytes, i, length);
            if (position < 0) break;
            bestLength = length;
            bestDistance = i - position;
        }
        if (bestLength >= MIN_MATCH) {
            tokens.push({ type: "match", length: bestLength, distance: bestDistance, cost: matchCost(bestLength, bestDistance) });
            i += bestLength;
        } else {
            tokens.push({ type: "literal", char: String.fromCharCode(bytes[i] as number), cost: LITERAL_COST });
            i += 1;
        }
    }
    return tokens;
}

/** Decode a token stream back into a byte string. */
function decode(tokens: Token[]): string {
    const out: number[] = [];
    for (const token of tokens) {
        if (token.type === "literal") {
            out.push(token.char.charCodeAt(0));
        } else {
            for (let k = 0; k < token.length; k += 1) {
                out.push(out[out.length - token.distance] as number);
            }
        }
    }
    return out.map((b) => String.fromCharCode(b)).join("");
}

function buildEntities(costs: number[], active: number): VisualEntity[] {
    return costs.map((cost, index) => ({
        id: `cost-${index}`,
        type: "bar" as const,
        label: String(cost),
        value: cost,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { tokenIndex: index, cost },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = typeof task.text === "string" && task.text.length > 0
        ? task.text
        : "TOBEORNOTTOBEORTOBEORNOT";
    const bytes = [...text].map((ch) => ch.charCodeAt(0));
    const n = bytes.length;

    const dp = new Array<number>(n + 1).fill(Infinity);
    const choice: Array<Token | null> = new Array<Token | null>(n + 1).fill(null);
    dp[0] = 0;
    for (let i = 0; i < n; i += 1) {
        if ((dp[i] as number) === Infinity) continue;
        const literalCost = (dp[i] as number) + LITERAL_COST;
        if (literalCost < (dp[i + 1] as number)) {
            dp[i + 1] = literalCost;
            choice[i + 1] = { type: "literal", char: String.fromCharCode(bytes[i] as number), cost: LITERAL_COST };
        }
        const limit = Math.min(MAX_MATCH, n - i);
        for (let length = MIN_MATCH; length <= limit; length += 1) {
            const position = findPrevious(bytes, i, length);
            if (position < 0) break;
            const cost = matchCost(length, i - position);
            const candidate = (dp[i] as number) + cost;
            if (candidate < (dp[i + length] as number)) {
                dp[i + length] = candidate;
                choice[i + length] = { type: "match", length, distance: i - position, cost };
            }
        }
    }

    const tokens: Token[] = [];
    let position = n;
    while (position > 0) {
        const token = choice[position];
        if (!token) break;
        tokens.push(token);
        position -= token.type === "literal" ? 1 : token.length;
    }
    tokens.reverse();
    const totalBits = tokens.reduce((s, token) => s + token.cost, 0);
    const greedy = greedyTokens(bytes);
    const greedyBits = greedy.reduce((s, token) => s + token.cost, 0);
    const decoded = decode(tokens);

    let step = 0;
    const cumulative: number[] = [0];
    yield {
        stepNumber: step++,
        entities: buildEntities(cumulative, -1),
        edges: [],
        description: `Searching an optimal LZ77 parse for ${n} bytes with a bit-cost dynamic program.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { text, inputLength: n, totalBits, greedyBits, phase: "start" },
    };

    let running = 0;
    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i] as Token;
        running += token.cost;
        cumulative.push(running);
        yield {
            stepNumber: step++,
            entities: buildEntities(cumulative, i + 1),
            edges: [],
            description: token.type === "literal"
                ? `Token ${i}: literal '${token.char}' for ${token.cost} bits; total ${running}.`
                : `Token ${i}: match length ${token.length} at distance ${token.distance} for ${token.cost} bits; total ${running}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { tokens: tokens.slice(0, i + 1), cumulative: [...cumulative], total: running, phase: "token" },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(cumulative, -1),
        edges: [],
        description: `Optimal parse uses ${totalBits} bits versus ${greedyBits} for greedy; decoded text is "${decoded}".`,
        codeLineNumber: 6,
        layout: "array",
        meta: { text, decoded, tokens, cumulative: [...cumulative], totalBits, greedyBits, inputLength: n, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A greedy compressor takes the longest match available at each byte, which can be shortsighted: a shorter match now may set up a much cheaper one later. Zopfli-style parsing enumerates the choices and uses dynamic programming to find the token stream with the smallest bit cost, which a greedy scan can miss.",
        invariants: [
            "The dynamic program stores the minimum cost to encode each prefix.",
            "Every token choice advances the input position by its encoded length.",
            "The reconstructed token stream decodes exactly to the source text.",
        ],
        correctness:
            "The recurrence considers every literal and every match starting at position i, and each option leads to a strictly larger prefix position, so the dependency graph is acyclic and dynamic programming finds the global minimum. Backtracking through the recorded choices reconstructs an optimal token stream. Replaying a literal emits its byte and replaying a match copies from the already produced output at the stored distance, so decoding returns the source exactly. The optimum cannot exceed the greedy cost because the greedy parse is one of the candidate paths.",
        complexityRationale:
            "For each of n positions the scan tries up to maxMatch lengths, and finding each most recent occurrence walks backwards O(n), giving O(n^2 * maxMatch) time with a bounded match constant. The DP table and choice array use O(n) space.",
        uses: [
            "Offline compression where output size matters more than speed",
            "Teaching optimal parsing versus greedy parsing",
            "Comparing token-cost models for LZ77 compressors",
        ],
        references: [
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977",
            "Google, Zopfli Compression Algorithm documentation",
        ],
        workedExample:
            "On 'ABABAB', a greedy parse takes the length-4 match 'ABAB' at distance 2 from position 2, while dynamic programming weighs shorter matches and literals at every start to choose the whole stream with the fewest bits under the cost model.",
    },
    id: "zopfli-compression",
    name: "Zopfli-Style Optimal LZ77 Parse",
    category: "production-systems",
    complexity: { time: "O(n^2 * maxMatch)", space: "O(n)" },
    defaultInput: { text: "TOBEORNOTTOBEORTOBEORNOT" },
    visualType: "array",
    run,
    pseudocode: [
        "convert the text to bytes and set the prefix costs to infinity",
        "for each position consider emitting a literal",
        "try every match length and find its most recent earlier occurrence",
        "relax the cost at the end of each candidate token",
        "backtrack through recorded choices to build the token list",
        "compare the optimal bit total with a greedy parse",
        "done: report the tokens, decoded text and both costs",
    ],
};

export default module;
