/**
 * shannon-fano-elias-coding.ts - Shannon-Fano-Elias Prefix Coding
 *
 * For symbols with probabilities p_i ordered by index, let F_i be the sum of
 * probabilities before symbol i and let Fbar_i = F_i + p_i/2 be the midpoint
 * of its interval on the unit line. The Shannon-Fano-Elias code of symbol i is
 * the first floor(log2(1/p_i)) + 1 bits of the binary expansion of Fbar_i.
 * Because each midpoint lies strictly inside its own interval and distinct
 * intervals are disjoint, the resulting codes are prefix-free.
 *
 *  Time:  O(total bits) after cumulatives
 *  Space: O(total bits)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SymbolProb {
    symbol: string;
    probability: number;
    cumulative: number;
    midpoint: number;
    length: number;
    code: string;
}

/** First `length` bits of the binary fraction expansion of x in [0, 1]. */
function fractionBits(x: number, length: number): string {
    let value = x;
    let bits = "";
    for (let i = 0; i < length; i += 1) {
        value *= 2;
        if (value >= 1) {
            bits += "1";
            value -= 1;
        } else {
            bits += "0";
        }
    }
    return bits;
}

/** Build Shannon-Fano-Elias codes for the given symbols and weights. */
function buildCodes(symbols: string[], weights: number[]): SymbolProb[] {
    const total = weights.reduce((sum, w) => sum + Math.max(0, Number(w) || 0), 0);
    const probs = weights.map((w) => (total > 0 ? Math.max(0, Number(w) || 0) / total : 1 / symbols.length));
    let cumulative = 0;
    return symbols.map((symbol, index) => {
        const p = probs[index] ?? 0;
        const midpoint = cumulative + p / 2;
        const length = p > 0 ? Math.floor(Math.log2(1 / p)) + 1 : 1;
        const code = fractionBits(midpoint, length);
        const result: SymbolProb = { symbol, probability: p, cumulative, midpoint, length, code };
        cumulative += p;
        return result;
    });
}

function isPrefixFree(codes: string[]): boolean {
    for (let i = 0; i < codes.length; i += 1) {
        for (let j = 0; j < codes.length; j += 1) {
            if (i !== j && (codes[j] as string).startsWith(codes[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

/** Decode a stream using a trie built from the codebook. */
function decodeStream(bits: string, table: SymbolProb[]): string[] {
    const trie: Record<string, unknown> = {};
    for (const entry of table) {
        let node = trie as Record<string, unknown>;
        for (const bit of entry.code) {
            node[bit] = node[bit] ?? {};
            node = node[bit] as Record<string, unknown>;
        }
        node.leaf = entry.symbol;
    }
    const out: string[] = [];
    let node = trie as Record<string, unknown>;
    for (const bit of bits) {
        node = node[bit] as Record<string, unknown>;
        if (node === undefined) {
            break;
        }
        if (typeof node.leaf === "string") {
            out.push(node.leaf);
            node = trie as Record<string, unknown>;
        }
    }
    return out;
}

function symbolEntities(table: SymbolProb[], current: number): VisualEntity[] {
    return table.map((entry, index) => ({
        id: `sym-${index}`,
        type: "character" as const,
        label: `${entry.symbol}:${entry.code}`,
        value: entry.symbol,
        state: (index === current ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, symbol: entry.symbol, code: entry.code, probability: entry.probability, midpoint: entry.midpoint },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { symbols?: string[]; weights?: number[] } | null) ?? {};
    const symbols = Array.isArray(cfg.symbols) && cfg.symbols.length > 0
        ? cfg.symbols.map((s) => String(s)).slice(0, 12)
        : ["a", "b", "c", "d"];
    const weights = Array.isArray(cfg.weights) && cfg.weights.length === symbols.length
        ? cfg.weights.map((w) => Math.max(0, Number(w) || 0))
        : [0.5, 0.25, 0.15, 0.1];
    const table = buildCodes(symbols, weights);
    const prefixFree = isPrefixFree(table.map((entry) => entry.code));
    const message = symbols.flatMap((symbol, index) => Array(Math.max(1, Math.round((weights[index] ?? 0) * 20))).fill(symbol));
    const codesBySymbol = new Map(table.map((entry) => [entry.symbol, entry.code]));
    const bits = message.map((symbol) => codesBySymbol.get(symbol) ?? "").join("");
    const decoded = decodeStream(bits, table);
    const roundTrip = decoded.join("") === message.join("");
    const kraft = table.reduce((sum, entry) => sum + 2 ** -entry.length, 0);
    const lines = 6;
    let step = 0;
    const F = (entities: VisualEntity[], description: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { bits, prefixFree, roundTrip, kraft, codeCount: table.length },
    });

    yield F(symbolEntities(table, -1), `Shannon-Fano-Elias coding for ${symbols.length} symbols by cumulative probability.`, 0);
    step += 1;
    for (let i = 0; i < table.length; i += 1) {
        const entry = table[i] as SymbolProb;
        yield F(
            symbolEntities(table, i),
            `${entry.symbol}: F = ${entry.cumulative.toFixed(3)}, midpoint = ${entry.midpoint.toFixed(3)}, ${entry.length} bits "${entry.code}".`,
            1,
        );
        step += 1;
    }
    yield F(symbolEntities(table, -1), `Code is prefix-free: ${prefixFree}; Kraft sum ${kraft.toFixed(3)} must be at most one.`, 3);
    step += 1;
    yield F(symbolEntities(table, -1), `Encoded ${message.length} symbols into ${bits.length} bits and decoded back (match: ${roundTrip}).`, 4);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Place the symbols end to end on the number line as intervals whose widths are their probabilities. Each symbol is represented by the midpoint of its interval. Writing the first few binary digits of that midpoint names a point inside the interval, and because intervals do not overlap and the midpoint is not on a boundary, that short binary fraction uniquely identifies the symbol. More probable symbols have wider intervals and therefore need fewer digits.",
        invariants: [
            "Cumulative probabilities increase and the last one reaches one.",
            "Each midpoint lies strictly inside its own interval.",
            "The code length is floor(log2(1/p)) + 1, so the Kraft sum is at most one.",
        ],
        correctness: "The code is the leading bits of a binary fraction for the midpoint F_i + p_i/2. Any infinite binary expansion of a number inside symbol i's interval begins with the digits of that midpoint truncated to length floor(log2(1/p_i)) + 1, because the interval width p_i exceeds 2 to the power of minus that length. Since these truncation prefixes for disjoint intervals cannot be nested, no codeword is a prefix of another. A decoder reading a generated stream therefore recovers exactly the original symbols.",
        complexityRationale: "Computing cumulatives and midpoints is linear in the number of symbols, and emitting each code takes a number of steps equal to its bit length. Total time and space are linear in the number of emitted bits plus the symbol count.",
        uses: [
            "A theoretical bridge between probability intervals and practical arithmetic coding",
            "Constructing prefix codes from known symbol probabilities",
            "Illustrating Shannon's source coding theorem with explicit codes",
        ],
        references: [
            "Cover and Thomas, Elements of Information Theory, Chapter 5 (Shannon-Fano-Elias codes)",
            "Elias, Universal Codeword Sets and Representations of the Integers, 1975",
        ],
        workedExample: "For probabilities 0.5, 0.25, 0.25, the cumulatives are 0, 0.5, 0.75 and the midpoints 0.25, 0.625, 0.875. With lengths 2, 3, 3, the binary fractions give codes 01, 101, 111. These are prefix-free and their Kraft sum is 1/4 + 1/8 + 1/8 = 1/2.",
    },
    id: "shannon-fano-elias-coding",
    name: "Shannon-Fano-Elias Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { symbols: ["a", "b", "c", "d"], weights: [0.5, 0.25, 0.15, 0.1] },
    visualType: "text",
    run,
    pseudocode: [
        "normalize the weights into probabilities and sort symbols by index",
        "accumulate the cumulative probability before each symbol",
        "set the midpoint to the cumulative plus half the probability",
        "set the length to floor(log2(1/p)) + 1 and take that many binary fraction bits",
        "verify the code is prefix-free and the Kraft sum is at most one",
        "encode a message and decode it with a prefix-code trie",
    ],
};

export default module;
