/**
 * shannon-fano-coding.ts - Shannon-Fano Prefix Coding
 *
 * Given a set of symbols with frequencies, Shannon-Fano coding builds a
 * prefix code by repeatedly sorting the remaining symbols by frequency and
 * splitting them into two groups whose frequency sums are as close as possible.
 * The first group receives a zero bit and the second a one bit, and the process
 * recurses until each group holds a single symbol.
 *
 *  Time:  O(n^2 log n) for n symbols in the straightforward recursive split
 *  Space: O(n) for the codebook
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Item {
    symbol: string;
    frequency: number;
    order: number;
}

/** Find the split point whose two group sums are closest. */
function bestSplit(items: Item[]): number {
    const total = items.reduce((sum, item) => sum + item.frequency, 0);
    let left = 0;
    let best = 1;
    let bestDiff = Infinity;
    for (let i = 0; i < items.length - 1; i += 1) {
        left += items[i]!.frequency;
        const diff = Math.abs(2 * left - total);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = i + 1;
        }
    }
    return best;
}

/** Build a prefix code for the given symbol-frequency pairs. */
function buildCodes(symbols: string[], frequencies: number[]): Map<string, string> {
    const items: Item[] = symbols.map((symbol, order) => ({ symbol, frequency: frequencies[order] ?? 0, order }));
    const codes = new Map<string, string>();
    const recurse = (group: Item[], prefix: string): void => {
        if (group.length === 0) {
            return;
        }
        if (group.length === 1) {
            codes.set(group[0]!.symbol, prefix || "0");
            return;
        }
        const sorted = [...group].sort((a, b) => b.frequency - a.frequency || a.order - b.order);
        const split = bestSplit(sorted);
        recurse(sorted.slice(0, split), prefix + "0");
        recurse(sorted.slice(split), prefix + "1");
    };
    recurse(items, "");
    return codes;
}

/** True when no codeword is a prefix of another. */
function isPrefixFree(codes: Map<string, string>): boolean {
    const all = [...codes.values()];
    for (let i = 0; i < all.length; i += 1) {
        for (let j = 0; j < all.length; j += 1) {
            if (i !== j && (all[j] as string).startsWith(all[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

/** Decode a bit stream using a prefix-code trie. */
function decodeStream(bits: string, codes: Map<string, string>): string[] {
    const trie: Record<string, unknown> = {};
    for (const [symbol, code] of codes) {
        let node = trie as Record<string, unknown>;
        for (const bit of code) {
            node[bit] = node[bit] ?? {};
            node = node[bit] as Record<string, unknown>;
        }
        node.leaf = symbol;
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

function symbolEntities(symbols: string[], codes: Map<string, string>, current: number): VisualEntity[] {
    return symbols.map((symbol, index) => ({
        id: `sym-${index}`,
        type: "character" as const,
        label: `${symbol}:${codes.get(symbol) ?? ""}`,
        value: symbol,
        state: (index === current ? "comparing" : codes.has(symbol) ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, symbol, code: codes.get(symbol) ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { symbols?: string[]; frequencies?: number[] } | null) ?? {};
    const symbols = Array.isArray(cfg.symbols) && cfg.symbols.length > 0
        ? cfg.symbols.map((s) => String(s)).slice(0, 12)
        : ["a", "b", "c", "d"];
    const frequencies = Array.isArray(cfg.frequencies) && cfg.frequencies.length === symbols.length
        ? cfg.frequencies.map((f) => Math.max(1, Number(f) || 1))
        : [45, 25, 20, 10];
    const codes = buildCodes(symbols, frequencies);
    const prefixFree = isPrefixFree(codes);
    const message = symbols.flatMap((symbol) => Array(Math.max(1, Math.round(frequencies[symbols.indexOf(symbol)] ?? 1))).fill(symbol));
    const bits = message.map((symbol) => codes.get(symbol) ?? "").join("");
    const decoded = decodeStream(bits, codes);
    const roundTrip = decoded.join("") === message.join("");
    const kraft = [...codes.values()].reduce((sum, code) => sum + 2 ** -code.length, 0);
    const lines = 6;
    let step = 0;
    const F = (entities: VisualEntity[], description: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { bits, prefixFree, roundTrip, kraft, codeCount: codes.size },
    });

    yield F(symbolEntities(symbols, codes, -1), `Shannon-Fano coding for ${symbols.length} symbols by descending frequency.`, 0);
    step += 1;
    for (let i = 0; i < symbols.length; i += 1) {
        yield F(
            symbolEntities(symbols, codes, i),
            `Symbol "${symbols[i]}" receives code "${codes.get(symbols[i] as string) ?? ""}".`,
            1,
        );
        step += 1;
    }
    yield F(symbolEntities(symbols, codes, -1), `Code is prefix-free: ${prefixFree}; Kraft sum ${kraft.toFixed(3)} must be at most one.`, 3);
    step += 1;
    yield F(symbolEntities(symbols, codes, -1), `Encoded ${message.length} symbols into ${bits.length} bits and decoded back (match: ${roundTrip}).`, 4);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Frequent symbols should get short codes. Shannon-Fano sorts symbols by frequency and keeps splitting the list into two halves with nearly equal total frequency, writing a zero for one half and a one for the other. Recursing until every half is a single symbol produces a prefix tree where common symbols sit near the root and rare symbols sit deeper.",
        invariants: [
            "At every split the two groups are contiguous in the frequency-sorted order.",
            "Each symbol receives exactly one binary string.",
            "The resulting code is prefix-free, so its Kraft sum is at most one.",
        ],
        correctness: "Because a zero or one bit is prepended only when descending into one side of a split, the code of a symbol is the sequence of side choices along its path in a binary tree whose leaves are the individual symbols. A tree assigns each leaf a unique root-to-leaf path, and no path is a prefix of another, so the code is prefix-free and uniquely decodable. The greedy near-equal split tends to give shorter paths to higher-frequency symbols.",
        complexityRationale: "At each recursive level the remaining symbols are sorted and scanned once; with n symbols and up to n levels this is O(n^2 log n) in the straightforward implementation. The codebook holds one string per symbol, using O(n) space apart from the emitted stream.",
        uses: [
            "An early method for text and fax compression",
            "Constructing frequency-based prefix codes as a teaching precursor to Huffman coding",
            "Assigning short identifiers to skewed symbol distributions",
        ],
        references: [
            "Shannon, A Mathematical Theory of Communication, 1948",
            "Fano, Transmission of Information, 1961",
        ],
        workedExample: "With symbols a,b,c,d and frequencies 45,25,20,10, the first split is a against b,c,d since their sums 45 and 55 are closest. The right group splits into b against c,d, and c,d split last. Codes might be a=0, b=10, c=110, d=111: common a gets one bit while rare d gets three.",
    },
    id: "shannon-fano-coding",
    name: "Shannon-Fano Coding",
    category: "string",
    complexity: { time: "O(n^2 log n)", space: "O(n)" },
    defaultInput: { symbols: ["a", "b", "c", "d"], frequencies: [45, 25, 20, 10] },
    visualType: "text",
    run,
    pseudocode: [
        "sort the remaining symbols by decreasing frequency",
        "find the split whose two frequency sums are closest",
        "prepend zero to the codes of the left group and one to the right group",
        "recurse on each group until one symbol remains",
        "verify the code is prefix-free and the Kraft sum is at most one",
        "encode a message and decode it with a prefix-code trie",
    ],
};

export default module;
