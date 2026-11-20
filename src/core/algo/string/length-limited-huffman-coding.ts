/**
 * length-limited-huffman-coding.ts - Package-Merge Length-Limited Prefix Codes
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Huffman code can grow longer than a decoder's word size allows. The
 * package-merge algorithm finds the prefix code with the smallest weighted
 * path length among all codes whose length is at most L. It repeatedly merges
 * the cheapest adjacent pair of the previous row into a new package and
 * inserts that package into the sorted original weights, then walks the rows
 * backward to read off each symbol's code length. Canonical assignment turns
 * those lengths into an actual prefix-free binary code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n L) for n symbols and maximum length L
 *   Space: O(n L) for the merge rows and package flags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Phase 1 frames show each sorted merge row; packages are highlighted.
 *   - Phase 2 frames show the code lengths as they are built bottom-up.
 *   - The final frame presents the canonical code for every symbol.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MergeRow {
    list: number[];
    packages: boolean[];
}

interface PmResult {
    lengths: number[];
    rows: MergeRow[];
    tracking: number[][];
}

/** Port of Larmore-Hirschberg package-merge on ascending positive weights. */
function packageMergeSorted(weights: number[], maxLength: number): PmResult {
    const n = weights.length;
    const lengths = new Array<number>(n).fill(0);
    if (n === 0) {
        return { lengths, rows: [], tracking: [] };
    }
    if (n <= 2) {
        for (let i = 0; i < n; i += 1) {
            lengths[i] = 1;
        }
        return { lengths, rows: [], tracking: [] };
    }

    const maxBuffer = 2 * n;
    let previous = weights.slice();
    let numPrevious = n;
    const isMerged = new Array<number>(maxBuffer).fill(0);
    const numRelevant = 2 * n - 2;
    const rows: MergeRow[] = [];
    let mask = 1;

    for (let bits = maxLength - 1; bits > 0; bits -= 1) {
        numPrevious -= numPrevious % 2;
        const current: number[] = [];
        current[0] = weights[0] as number;
        current[1] = weights[1] as number;
        let sum = (current[0] as number) + (current[1] as number);
        let numCurrent = 2;
        let numHist = 2;
        let numMerged = 0;
        for (;;) {
            if (numHist < n && (weights[numHist] as number) <= sum) {
                current[numCurrent] = weights[numHist] as number;
                numCurrent += 1;
                numHist += 1;
                continue;
            }
            isMerged[numCurrent] = (isMerged[numCurrent] ?? 0) | mask;
            current[numCurrent] = sum;
            numCurrent += 1;
            numMerged += 1;
            if (numMerged * 2 >= numPrevious) {
                break;
            }
            sum = (previous[numMerged * 2] as number) + (previous[numMerged * 2 + 1] as number);
        }
        while (numHist < n) {
            current[numCurrent] = weights[numHist] as number;
            numCurrent += 1;
            numHist += 1;
        }

        rows.push({
            list: current.slice(),
            packages: current.map((_value, index) => ((isMerged[index] ?? 0) & mask) !== 0),
        });
        mask <<= 1;

        if (numPrevious >= numRelevant) {
            let identical = true;
            for (let i = numRelevant - 1; i > 0; i -= 1) {
                if (previous[i] !== current[i]) {
                    identical = false;
                    break;
                }
            }
            if (identical) {
                break;
            }
        }
        previous = current;
        numPrevious = numCurrent;
    }
    mask >>= 1;

    const tracking: number[][] = [];
    let numAnalyze = numRelevant;
    while (mask !== 0) {
        let numMerged = 0;
        lengths[0] = (lengths[0] as number) + 1;
        lengths[1] = (lengths[1] as number) + 1;
        let symbol = 2;
        for (let i = symbol; i < numAnalyze; i += 1) {
            if (((isMerged[i] ?? 0) & mask) === 0) {
                lengths[symbol] = (lengths[symbol] as number) + 1;
                symbol += 1;
            } else {
                numMerged += 1;
            }
        }
        numAnalyze = 2 * numMerged;
        tracking.push(lengths.slice());
        mask >>= 1;
    }
    for (let i = 0; i < numAnalyze; i += 1) {
        lengths[i] = (lengths[i] as number) + 1;
    }
    return { lengths, rows, tracking };
}

/** Assign canonical prefix codes from a list of code lengths. */
function canonicalCodes(lengths: number[]): string[] {
    const codes = new Array<string>(lengths.length).fill("");
    const order = Array.from({ length: lengths.length }, (_unused, index) => index)
        .filter((index) => (lengths[index] as number) > 0)
        .sort((a, b) => (lengths[a] as number) - (lengths[b] as number) || a - b);
    if (order.length === 0) {
        return codes;
    }
    let code = 0;
    let previousLength = lengths[order[0] as number] as number;
    for (const index of order) {
        const length = lengths[index] as number;
        code <<= length - previousLength;
        codes[index] = code.toString(2).padStart(length, "0");
        code += 1;
        previousLength = length;
    }
    return codes;
}

function cells(
    entries: { label: string; state: EntityState }[],
    cols: number,
): VisualEntity[] {
    return entries.map((entry, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: entry.label,
        value: entry.label,
        state: entry.state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / cols), col: index % cols },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; maxLength?: number; symbols?: string[] } | null) ?? {};
    const rawWeights = Array.isArray(task.weights)
        ? (task.weights as number[]).slice()
        : [270, 20, 10, 1, 6, 1];
    const symbols = Array.isArray(task.symbols) && task.symbols.length === rawWeights.length
        ? (task.symbols as string[]).slice()
        : rawWeights.map((_weight, index) => String.fromCharCode(65 + index));

    let limit = Math.floor(Number(task.maxLength));
    if (!Number.isFinite(limit) || limit < 1) {
        limit = 4;
    }
    limit = Math.min(limit, 16);
    while (Math.pow(2, limit) < rawWeights.filter((w) => w > 0).length && limit < 20) {
        limit += 1;
    }

    const active = rawWeights
        .map((weight, index) => ({ weight: Math.max(0, Math.floor(weight)), index }))
        .filter((entry) => entry.weight > 0)
        .sort((a, b) => a.weight - b.weight || a.index - b.index);
    const sortedWeights = active.map((entry) => entry.weight);
    const result = packageMergeSorted(sortedWeights, limit);

    const finalLengths = new Array<number>(rawWeights.length).fill(0);
    active.forEach((entry, sortedIndex) => {
        finalLengths[entry.index] = result.lengths[sortedIndex] as number;
    });
    const codes = canonicalCodes(finalLengths);

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(
            rawWeights.map((weight, index) => ({
                label: `${symbols[index]}:${weight}`,
                state: "idle" as EntityState,
            })),
            Math.max(rawWeights.length, 1),
        ),
        edges: [],
        description: `Build a prefix code for ${active.length} active symbol(s) with a maximum length of ${limit} bits.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: Math.max(rawWeights.length, 1), phase: "setup", maxLength: limit },
    };
    step += 1;

    for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex += 1) {
        const row = result.rows[rowIndex] as MergeRow;
        yield {
            stepNumber: step,
            entities: cells(
                row.list.map((value, index) => ({
                    label: row.packages[index] ? `[${value}]` : String(value),
                    state: (row.packages[index] ? "comparing" : "idle") as EntityState,
                })),
                Math.max(row.list.length, 1),
            ),
            edges: [],
            description: `Merge row ${rowIndex + 1}: packages in brackets are inserted into the sorted weight list.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: Math.max(row.list.length, 1),
                phase: "merge",
                row: rowIndex + 1,
                packages: row.packages,
            },
        };
        step += 1;
    }

    for (let trackIndex = 0; trackIndex < result.tracking.length; trackIndex += 1) {
        const lengths = result.tracking[trackIndex] as number[];
        yield {
            stepNumber: step,
            entities: cells(
                active.map((entry, index) => ({
                    label: `${symbols[entry.index]}:${lengths[index]}`,
                    state: "active" as EntityState,
                })),
                Math.max(active.length, 1),
            ),
            edges: [],
            description: `Backward pass ${trackIndex + 1}: a plain item raises its symbol's length by one bit.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: 1,
                cols: Math.max(active.length, 1),
                phase: "tracking",
                pass: trackIndex + 1,
                lengths: lengths.slice(),
            },
        };
        step += 1;
    }

    let kraft = 0;
    for (const length of finalLengths) {
        if (length > 0) {
            kraft += Math.pow(2, -length);
        }
    }
    yield {
        stepNumber: step,
        entities: cells(
            rawWeights.map((weight, index) => ({
                label: `${symbols[index]}:${finalLengths[index]}=${codes[index]}`,
                state: (weight > 0 ? "sorted" : "idle") as EntityState,
            })),
            Math.max(rawWeights.length, 1),
        ),
        edges: [],
        description: `Optimal length-limited code found with Kraft sum ${kraft.toFixed(4)} and ${active.length} symbol(s).`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols: Math.max(rawWeights.length, 1),
            phase: "done",
            lengths: finalLengths.slice(),
            codes: codes.slice(),
            kraft,
            maxLength: limit,
        },
    };
}

/** The length-limited Huffman coding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain Huffman coding may produce a codeword longer than a decoder can store. Package-merge limits every length by building the code from the cheapest mergeable pairs. Each merge packages two adjacent weights into a new item and reinserts it, so the cheapest symbols receive the shortest codes while no code exceeds the bound.",
        invariants: [
            "Every merge row stays sorted in nondecreasing weight order.",
            "A package always equals the sum of two adjacent items from the previous row.",
            "The backward pass only increments lengths of plain (unpackaged) items.",
            "The resulting lengths satisfy the Kraft inequality and never exceed the limit.",
        ],
        correctness:
            "Package-merge solves the equivalent coin-collector problem: selecting the cheapest set of coins whose widths meet the Kraft requirement. Greedily taking the cheapest adjacent package is optimal for that problem by an exchange argument, so the lengths read back in the second phase minimize total weighted path length subject to the length bound. Canonical assignment then yields a prefix-free code with exactly those lengths.",
        complexityRationale:
            "There are at most L minus one merge rows, and each row inserts at most n packages into a list of size at most two n, costing O(n) per row. The backward pass also scans at most two n entries per row, so time and space are both O(n L).",
        uses: [
            "Huffman stages in DEFLATE and JPEG with a 16-bit code limit",
            "Software decoders that store codewords in fixed-width integers",
            "Any prefix code where worst-case decode time must be bounded",
        ],
        references: [
            "Larmore and Hirschberg, A Fast Algorithm for Optimal Length-Limited Huffman Codes, 1990",
            "Cover and Thomas, Elements of Information Theory, source-coding chapter",
        ],
        workedExample:
            "For weights 1, 1, 6, 10, 20, 270 with a limit of 4 bits, package-merge returns lengths 4, 4, 4, 4, 2, 1 in ascending weight order. Canonical codes are 0000, 0001, 0010, 0011, 010 and 1. The Kraft sum is four sixteenths plus one quarter plus one half, which equals one, so the code is complete.",
    },
    id: "length-limited-huffman-coding",
    name: "Length-Limited Huffman Coding (Package-Merge)",
    category: "string",
    complexity: { time: "O(n L)", space: "O(n L)" },
    defaultInput: {
        weights: [270, 20, 10, 1, 6, 1],
        symbols: ["a", "b", "c", "d", "e", "f"],
        maxLength: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the nonzero weights in ascending order",
        "start the first merge row with the original weights",
        "for each bit level up to the length limit",
        "merge each adjacent pair into a package and insert it in sorted order",
        "record which entries of the row are packages",
        "walk the rows backward from the last to the first",
        "increment a symbol's length for each plain item encountered",
        "assign canonical binary codes from the final lengths",
        "done: report lengths, codes, and the Kraft sum",
    ],
};

export default module;
