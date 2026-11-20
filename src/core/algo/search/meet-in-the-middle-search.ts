/**
 * meet-in-the-middle-search.ts - Meet-in-the-Middle Subset Sum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A brute-force subset-sum search tries all 2^n subsets. Meet in the middle
 * splits the values into two halves, lists every subset sum of each half, sorts
 * the right-hand list, and binary-searches it for the complement of each left
 * sum. That replaces 2^n work with roughly 2^(n/2) work at the cost of storing
 * the sums. Ties are broken by choosing the smallest subset.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(n/2) * n) to enumerate, sort, and probe the half lists
 *   Space: O(2^(n/2)) for the stored subset sums
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The selected subset bars are GREEN (path); probed left/right bars are
 *     YELLOW (comparing).
 *   - The caption reports the complement being searched for on each probe.
 *   - The final frame names the chosen indices and their sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MitmInput {
    values?: number[];
    target?: number;
}

interface SumEntry {
    sum: number;
    mask: number;
}

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function subsets(values: number[]): SumEntry[] {
    const result: SumEntry[] = [];
    for (let mask = 0; mask < 1 << values.length; mask += 1) {
        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            if ((mask & (1 << i)) !== 0) {
                sum += values[i] as number;
            }
        }
        result.push({ sum, mask });
    }
    return result.sort((a, b) => a.sum - b.sum || a.mask - b.mask);
}

function popcount(mask: number): number {
    let count = 0;
    while (mask > 0) {
        count += mask & 1;
        mask >>= 1;
    }
    return count;
}

function firstAtLeast(sorted: SumEntry[], target: number): number {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if ((sorted[mid] as SumEntry).sum < target) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MitmInput | null) ?? {};
    const values = Array.isArray(task.values) ? [...task.values] : [8, 7, 6, 5, 4, 3];
    const target = typeof task.target === "number" ? task.target : 14;
    const half = Math.floor(values.length / 2);
    const leftValues = values.slice(0, half);
    const rightValues = values.slice(half);
    const left = subsets(leftValues);
    const right = subsets(rightValues);

    let step = 0;
    let tested = 0;
    let bestSize = Number.POSITIVE_INFINITY;
    let bestIndices: number[] = [];
    let bestSum = 0;
    let found = false;

    const statesFor = (leftMask: number, rightMask: number): Map<number, EntityState> => {
        const states = new Map<number, EntityState>();
        for (let i = 0; i < values.length; i += 1) {
            const bit = i < half ? leftMask & (1 << i) : rightMask & (1 << (i - half));
            if (bit !== 0) {
                states.set(i, "path");
            }
        }
        return states;
    };

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Meet in the middle: split ${values.length} values into halves of ${leftValues.length} and ${rightValues.length}, then match subset sums to target ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { target, leftCount: 0, rightCount: 0, tested, found: false, bestSize: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Enumerated ${left.length} left subset sum(s) and ${right.length} right subset sum(s); the right list is sorted for binary search.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { target, leftCount: left.length, rightCount: right.length, tested, found: false, bestSize: -1 },
    };
    step += 1;

    const stride = Math.max(1, Math.floor(left.length / 24));
    for (const leftEntry of left) {
        const need = target - leftEntry.sum;
        tested += 1;
        const index = firstAtLeast(right, need);
        let match: SumEntry | undefined = right[index];
        for (let k = index; k < right.length && (right[k] as SumEntry).sum === need; k += 1) {
            const candidate = right[k] as SumEntry;
            const size = popcount(leftEntry.mask) + popcount(candidate.mask);
            if (size < bestSize) {
                found = true;
                bestSize = size;
                bestSum = target;
                match = candidate;
                bestIndices = [];
                for (let i = 0; i < half; i += 1) {
                    if ((leftEntry.mask & (1 << i)) !== 0) {
                        bestIndices.push(i);
                    }
                }
                for (let i = 0; i < rightValues.length; i += 1) {
                    if ((candidate.mask & (1 << i)) !== 0) {
                        bestIndices.push(half + i);
                    }
                }
            }
        }
        if (match && match.sum !== need) {
            match = undefined;
        }
        if (tested % stride === 0 || bestSize === 1) {
            yield {
                stepNumber: step,
                entities: makeBars(values, statesFor(leftEntry.mask, match && match.sum === need ? match.mask : 0)),
                edges: [],
                description: `Probe ${tested}: left sum ${leftEntry.sum} needs ${need}; ${match && match.sum === need ? "a matching right subset exists" : "no right subset matches"}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: {
                    target,
                    leftCount: left.length,
                    rightCount: right.length,
                    tested,
                    found,
                    bestSize: found ? bestSize : -1,
                    probing: leftEntry.sum,
                    needed: need,
                },
            };
            step += 1;
        }
    }

    const finalStates = statesFor(0, 0);
    for (const index of bestIndices) {
        finalStates.set(index, "path");
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, finalStates),
        edges: [],
        description: found
            ? `Found subset ${bestIndices.join(", ")} summing to ${bestSum} with ${bestSize} value(s) after ${tested} binary search(es).`
            : `No subset of the given values sums to ${target}; ${tested} complement(s) were checked.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            target,
            leftCount: left.length,
            rightCount: right.length,
            tested,
            found,
            bestSize: found ? bestSize : -1,
            bestSum: found ? bestSum : 0,
            subset: bestIndices,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Splitting a list in half turns an exponential search into two much smaller ones. Write down the sum of every subset of each half, sort one list, and for each sum on the left binary-search the right list for the exact complement. The two matching halves combine into a full solution.",
        invariants: [
            "Every subset of the whole list is the union of exactly one left subset and one right subset.",
            "The right-hand sums are kept in sorted order, so binary search is valid.",
            "bestSize is the cardinality of the smallest matching pair found so far.",
        ],
        correctness:
            "Any subset achieving the target decomposes into a left sum L and a right sum R with L + R equal to the target. The algorithm enumerates both lists in full, so when it probes L with complement target minus L it must find R if the subset exists. Conversely, a found complement produces a valid subset whose sum is the target, and keeping the smallest cardinality yields an optimal-size answer.",
        complexityRationale:
            "Each half has 2^(n/2) subsets, so enumeration, sorting, and all binary searches together cost O(2^(n/2) times n). Storing one sum per half subset uses O(2^(n/2)) space, the classic time-space tradeoff.",
        uses: [
            "Cryptographic knapsack attacks where the key space can be halved",
            "Exact subset-sum solvers for moderate input sizes",
            "A standard technique for splitting exponential searches in two",
        ],
        references: [
            "Horowitz and Sahni, On Computing the Number of Binary Partitions of a Integer, 1974",
            "Wikipedia, Meet-in-the-middle attack",
        ],
        workedExample:
            "For values 8, 7, 6, 5, 4, 3 and target 14, split into 8, 7, 6 and 5, 4, 3. The left sum 8 needs 6, which no right subset makes; the left sum 14 needs 0, matched by the empty right subset, so indices 0 and 2 give 8 + 6 = 14 with only two values.",
    },
    id: "meet-in-the-middle-search",
    name: "Meet-in-the-Middle Search",
    category: "searching",
    complexity: { time: "O(2^(n/2) * n)", space: "O(2^(n/2))" },
    defaultInput: { values: [8, 7, 6, 5, 4, 3], target: 14 },
    visualType: "array",
    run,
    pseudocode: [
        "split the values into a left half and a right half",
        "enumerate every subset sum of each half",
        "sort the right-hand list of sums",
        "for each left sum binary-search for target minus that sum",
        "when a match is found record the smaller subset size",
        "repeat until all left sums have been probed",
        "done: report the matching subset indices and their sum",
    ],
};

export default module;
