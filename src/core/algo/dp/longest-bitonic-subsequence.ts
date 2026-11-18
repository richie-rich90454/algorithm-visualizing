/**
 * longest-bitonic-subsequence.ts - Longest Bitonic Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: bitonic[i] <- inc[i] + dec[i] - 1 per peak candidate.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nums?: number[] } | null) ?? {};
    const nums = task.nums ?? [1, 11, 2, 10, 4, 5, 2, 1];
    let step = 0;
    if (nums.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 length 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = nums.length;
    const inc: number[] = new Array<number>(n).fill(1);
    const dec: number[] = new Array<number>(n).fill(1);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < i; j += 1) {
            if ((nums[j] ?? 0) < (nums[i] ?? 0) && (inc[j] ?? 0) + 1 > (inc[i] ?? 0))
                inc[i] = (inc[j] ?? 0) + 1;
        }
    }
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = n - 1; j > i; j -= 1) {
            if ((nums[j] ?? 0) < (nums[i] ?? 0) && (dec[j] ?? 0) + 1 > (dec[i] ?? 0))
                dec[i] = (dec[j] ?? 0) + 1;
        }
    }
    const show = () => [[...inc], [...dec]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Bitonic peak search on [${nums.join(", ")}]. Row 0 = LIS, row 1 = LDS.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    let best = 1;
    let peak = 0;
    for (const i of [1, 3, 5, 7].filter((x) => x < n)) {
        const total = (inc[i] ?? 1) + (dec[i] ?? 1) - 1;
        if (total > best) {
            best = total;
            peak = i;
        }
        const states = new Map<string, EntityState>([
            [`0,${i}`, "comparing"],
            [`1,${i}`, "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Peak candidate ${i} (value ${nums[i]}): ${inc[i]} + ${dec[i]} - 1 = ${total}; best ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const marks = new Map<string, EntityState>([
        [`0,${peak}`, "sorted"],
        [`1,${peak}`, "sorted"],
    ]);
    yield {
        stepNumber: step,
        entities: makeCells(show(), marks),
        edges: [],
        description: `Traceback: peak at ${peak} (value ${nums[peak]}), bitonic length ${best}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: best },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A bitonic subsequence first increases to a peak and then decreases. The DP computes inc[i], the longest increasing subsequence ending at i, and dec[i], the longest decreasing subsequence starting at i. Combining them at each candidate peak gives inc[i] + dec[i] - 1, subtracting one because the peak is counted twice.",
        "invariants": [
            "inc[i] is computed by a forward LIS pass; dec[i] by a reverse LIS pass.",
            "Each index is considered exactly once as the peak.",
            "A valid bitonic subsequence consists of an increasing part and a decreasing part meeting at the peak."
        ],
        "correctness": "Choosing a peak i, the increasing prefix ending there has length inc[i] and the decreasing suffix starting there has length dec[i]; concatenating them yields a bitonic subsequence. Because the two parts share only the peak, the combined length is their sum minus one. Maximizing over i gives the optimum.",
        "complexityRationale": "Each of the two LIS-style passes scans O(n^2) pairs, giving O(n^2) time. The inc and dec arrays use O(n) space.",
        "uses": [
            "Finding peak-shaped trends in numerical data",
            "Sequencing problems with rise-then-fall constraints",
            "A two-pass DP teaching example"
        ],
        "references": [
            "GeeksforGeeks, Longest Bitonic Subsequence",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For [1,11,2,10,4,5,2,1] the peak 11 has inc = 2 and dec = 5, giving a bitonic length of 6. The DP reports the best such combination over all peaks."
    },
    id: "longest-bitonic-subsequence",
    name: "Longest Bitonic Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { nums: [1, 11, 2, 10, 4, 5, 2, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up inc[i] <- LIS ending at i and dec[i] <- LDS from i",
        "inc uses forward LIS, dec uses reverse LIS passes",
        "bitonic[i] <- inc[i] + dec[i] - 1 per peak candidate",
        "compute both directional tables before combining",
        "each index serves once as the bitonic peak point",
        "subtract one to avoid double counting the peak",
        "answer <- max bitonic length with peak index reported",
    ],
};

export default module;
