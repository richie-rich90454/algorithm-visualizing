/**
 * maximal-rectangle-binary-matrix.ts - Maximal Rectangle (Binary Matrix)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: rowBest <- largest rectangle in histogram via stack scan.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m\u00b7n)
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

function largestRect(heights: number[]): number {
    const hs = [...heights, 0];
    const stack: number[] = [];
    let best = 0;
    for (let i = 0; i < hs.length; i += 1) {
        while (stack.length > 0 && (hs[stack[stack.length - 1] as number] ?? 0) > (hs[i] ?? 0)) {
            const h = hs[stack.pop() as number] ?? 0;
            const left = stack.length === 0 ? 0 : (stack[stack.length - 1] as number) + 1;
            const area = h * (i - left);
            if (area > best) best = area;
        }
        stack.push(i);
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: string[][] } | null) ?? {};
    const matrix = task.matrix ?? [
        ["1", "0", "1", "0", "0"],
        ["1", "0", "1", "1", "1"],
        ["1", "1", "1", "1", "1"],
        ["1", "0", "0", "1", "0"],
    ];
    let step = 0;
    if (matrix.length === 0 || (matrix[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty matrix \u2013 area 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const m = matrix.length;
    const cols = (matrix[0] ?? []).length;
    const heights: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(0));
    let best = 0;
    yield {
        stepNumber: step,
        entities: makeCells(heights),
        edges: [],
        description: `Largest all-'1' rectangle in ${m}x${cols} via column histograms.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            heights[i][j] =
                (matrix[i]?.[j] ?? "0") === "1" ? (i > 0 ? (heights[i - 1]?.[j] ?? 0) : 0) + 1 : 0;
        }
        const rowBest = largestRect(heights[i] ?? []);
        if (rowBest > best) best = rowBest;
        const states = new Map<string, EntityState>([[`${i},${cols - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(heights, states),
            edges: [],
            description: `Row ${i} histogram: best ${rowBest}; global ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, cols },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(heights),
        edges: [],
        description: `Traceback: max rectangle area = ${best}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: best },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Maximal rectangle finds the all-ones rectangle of largest area in a binary matrix. Treating each row as the bottom of a histogram, heights[c] counts consecutive ones ending at that row in column c. For every row the largest rectangle in that histogram is computed with a monotone stack, and the global best is tracked.",
        "invariants": [
            "heights[c] equals the number of consecutive ones ending at the current row in column c.",
            "For a fixed row, any all-ones rectangle ending there corresponds to a histogram rectangle.",
            "The stack-based histogram scan considers every possible bar height as the limiting height."
        ],
        "correctness": "Any all-ones rectangle has a bottom row; at that row its width and limiting height form a rectangle in the histogram, so scanning every row's histogram covers every candidate. The monotone-stack histogram algorithm computes the maximal rectangle exactly by popping when a shorter bar bounds the span. Hence the tracked maximum is correct.",
        "complexityRationale": "Each row updates n heights and the histogram scan pushes and pops each column once, O(n) per row, giving O(m*n) time. The heights array and stack use O(n) space.",
        "uses": [
            "Finding free rectangular regions in grid layouts",
            "Image analysis of binary masks",
            "A reduction from grid DP to stack-based histogram scan"
        ],
        "references": [
            "LeetCode problem 85, Maximal Rectangle",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.2"
        ],
        "workedExample": "In the sample matrix the third row has heights [3,1,3,2,2]. Its largest histogram rectangle has area 3*2 = 6 from the last three columns of height 2, which is the maximal all-ones rectangle."
    },
    id: "maximal-rectangle-binary-matrix",
    name: "Maximal Rectangle (Binary Matrix)",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(n)" },
    defaultInput: {
        matrix: [
            ["1", "0", "1", "0", "0"],
            ["1", "0", "1", "1", "1"],
            ["1", "1", "1", "1", "1"],
            ["1", "0", "0", "1", "0"],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set up heights per column histogram starting at zero",
        "heights[c] holds consecutive ones ending at current row",
        "rowBest <- largest rectangle in histogram via stack scan",
        "update heights row by row accumulating column runs",
        "each row solves a histogram max-rectangle subproblem",
        "track global best across all processed rows",
        "answer <- max area with rows and bounds reconstructed",
    ],
};

export default module;
