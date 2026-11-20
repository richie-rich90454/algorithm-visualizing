/**
 * dictionary-encoding-rle.ts - Dictionary Encoding Followed by Run-Length Encoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This two-stage compressor first replaces each distinct input symbol with a
 * small integer rank from a dictionary built in first-appearance order, then
 * run-length encodes the rank stream into count and rank pairs. The decoder
 * expands the pairs back into ranks and maps them through the dictionary to
 * recover the original text. Dictionary encoding shrinks each symbol from a
 * wide character code to a compact rank; run-length encoding then collapses
 * long repeats of the same symbol into a single pair.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a symbol lookup table and one linear RLE sweep
 *   Space: O(n) for the rank stream, pairs, and display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows the original symbols; row one shows the RLE pairs.
 *   - A frame is emitted for each symbol appended to the dictionary and each
 *     run collapsed into a pair.
 *   - The final frame reports the pair stream and round-trip success.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface DictionaryRleResult {
    dictionary: string[];
    ranks: number[];
    pairs: Array<[number, number]>;
    originalLength: number;
    encodedSymbols: number;
    roundTrip: string;
}

/** Build a first-appearance dictionary, emit ranks, then RLE the ranks. */
export function dictionaryRleEncode(text: string): DictionaryRleResult {
    const symbols = [...text];
    const dictionary: string[] = [];
    const lookup = new Map<string, number>();
    const ranks: number[] = [];
    for (const symbol of symbols) {
        let rank = lookup.get(symbol);
        if (rank === undefined) {
            rank = dictionary.length;
            dictionary.push(symbol);
            lookup.set(symbol, rank);
        }
        ranks.push(rank);
    }

    const pairs: Array<[number, number]> = [];
    for (const rank of ranks) {
        const last = pairs[pairs.length - 1];
        if (last && last[1] === rank) {
            last[0] += 1;
        } else {
            pairs.push([1, rank]);
        }
    }

    const decodedRanks: number[] = [];
    for (const [count, rank] of pairs) {
        for (let k = 0; k < count; k += 1) {
            decodedRanks.push(rank);
        }
    }
    const roundTrip = decodedRanks.map((rank) => dictionary[rank] ?? "").join("");

    return {
        dictionary,
        ranks,
        pairs,
        originalLength: symbols.length,
        encodedSymbols: pairs.length * 2,
        roundTrip,
    };
}

/** Grid cells for the original symbols and the emitted RLE pairs. */
function makeCells(
    text: string,
    result: DictionaryRleResult,
    revealedSymbols: number,
    revealedPairs: number,
    phase: string,
): VisualEntity[] {
    const symbols = [...text];
    const cols = Math.max(1, symbols.length, result.pairs.length);
    const cells: VisualEntity[] = [];
    for (let col = 0; col < cols; col += 1) {
        const symbol = symbols[col] ?? "";
        const known = col < revealedSymbols;
        cells.push({
            id: `cell-symbol-${col}`,
            type: "cell",
            label: symbol === " " ? "_" : symbol,
            value: symbol,
            state: phase === "done" ? "sorted" : known ? "visited" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, role: "symbol", rank: known ? result.ranks[col] ?? 0 : -1 },
        });
    }
    for (let col = 0; col < cols; col += 1) {
        const pair = result.pairs[col];
        const known = col < revealedPairs;
        const label = pair ? `${pair[0]}x${pair[1]}` : "-";
        cells.push({
            id: `cell-pair-${col}`,
            type: "cell",
            label,
            value: pair ? pair[0] * 100 + pair[1] : 0,
            state: phase === "done" ? "sorted" : known ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, role: "pair" },
        });
    }
    return cells;
}

/** The dictionary plus run-length encoding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text =
        typeof task.text === "string" && task.text.length > 0 ? task.text : "AAAABBBCCDDDDEEEE";
    const result = dictionaryRleEncode(text);
    const symbols = [...text];
    const cols = Math.max(1, symbols.length, result.pairs.length);
    const base = {
        originalLength: result.originalLength,
        dictionarySize: result.dictionary.length,
        dictionary: result.dictionary,
        ranks: result.ranks,
        pairCount: result.pairs.length,
        encodedSymbols: result.encodedSymbols,
        roundTrip: "",
        roundTripOk: false,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(text, result, 0, 0, "setup"),
        edges: [],
        description: `Encoding ${symbols.length} symbol(s) with a first-appearance dictionary and run-length coding.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows: 2, cols, phase: "setup" },
    };

    for (let i = 0; i < symbols.length; i += 1) {
        yield {
            stepNumber: 1 + i,
            entities: makeCells(text, result, i + 1, 0, "dictionary"),
            edges: [],
            description: `Symbol '${symbols[i]}' maps to rank ${result.ranks[i]}; dictionary now holds ${new Set(symbols.slice(0, i + 1)).size} symbol(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...base, rows: 2, cols, phase: "dictionary", index: i, rank: result.ranks[i] },
        };
    }

    for (let i = 0; i < result.pairs.length; i += 1) {
        const pair = result.pairs[i]!;
        yield {
            stepNumber: 1 + symbols.length + i,
            entities: makeCells(text, result, symbols.length, i + 1, "rle"),
            edges: [],
            description: `Run ${i + 1}: ${pair[0]} repeat(s) of rank ${pair[1]} collapse into one count-rank pair.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...base, rows: 2, cols, phase: "rle", pairIndex: i, count: pair[0], rank: pair[1] },
        };
    }

    yield {
        stepNumber: 1 + symbols.length + result.pairs.length,
        entities: makeCells(text, result, symbols.length, result.pairs.length, "done"),
        edges: [],
        description: `${symbols.length} symbol(s) became ${result.pairs.length} pair(s) over a ${result.dictionary.length}-symbol dictionary; round trip ${result.roundTrip === text ? "exact" : "failed"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...base,
            rows: 2,
            cols,
            phase: "done",
            roundTrip: result.roundTrip,
            roundTripOk: result.roundTrip === text,
            done: true,
        },
    };
}

/** The dictionary plus run-length encoding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Many symbols are wide character codes even when the alphabet is tiny. Dictionary encoding first replaces each distinct symbol with a short rank, so the alphabet becomes as small as the data allows. Run-length encoding then replaces consecutive equal ranks with a single count and rank pair. The two stages are independent, and each one is exactly reversible when the dictionary is kept with the stream.",
        invariants: [
            "Ranks are assigned in first-appearance order from zero to the dictionary size minus one.",
            "Every RLE pair has a positive count and a rank that exists in the dictionary.",
            "Expanding the pairs and mapping ranks back through the dictionary reproduces the input exactly.",
        ],
        correctness:
            "The dictionary lookup assigns one rank per distinct symbol, so the rank stream uniquely determines the symbol stream given the dictionary. Run-length encoding partitions the rank stream into maximal runs; storing each run as count and rank preserves both the order and the multiplicity, so expansion restores the rank stream exactly. Composing the two inverse steps therefore returns the original text for every input, including the empty string.",
        complexityRationale:
            "A hash map answers each symbol lookup in expected constant time, and the RLE sweep appends or increments one pair per rank, so the whole encoder is O(n) time. The dictionary, rank stream, pair list, and display cells use O(n) space.",
        uses: [
            "Columnar storage dictionaries for low-cardinality fields",
            "Compressing repeated flags, categories, and run-heavy telemetry",
            "A teaching pipeline for combining two lossless transforms",
        ],
        references: [
            "Golomb, Run-Length Encodings, IEEE Transactions on Information Theory, 1966",
            "Abadi et al., The Design and Implementation of Modern Column-Oriented Database Systems, dictionary encoding",
        ],
        workedExample:
            "The text AAAABBBCCDDDDEEEE has dictionary A, B, C, D, E with ranks 0 through 4. Its rank stream is 000011112233334444, which run-length encoding becomes the pairs (4,0), (4,1), (2,2), (4,3), (4,4). Expanding the pairs and mapping ranks back returns the original text.",
    },
    id: "dictionary-encoding-rle",
    name: "Dictionary Encoding with RLE",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "AAAABBBCCDDDDEEEE" },
    visualType: "grid",
    run,
    pseudocode: [
        "scan the input and assign each new symbol the next dictionary rank",
        "replace every symbol with its rank from the dictionary",
        "start an empty run-length pair list",
        "for each rank increment the last pair count when it matches, else append a new pair",
        "decode by expanding every count-rank pair into repeated ranks",
        "map decoded ranks back through the dictionary to recover the symbols",
        "done: report dictionary size, pair count, and round-trip result",
    ],
};

export default module;
