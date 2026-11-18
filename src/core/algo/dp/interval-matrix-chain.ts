/**
 * interval-matrix-chain.ts – Matrix Chain Multiplication (interval DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given matrices A1..An with dimensions, matrix chain multiplication asks for
 * the parenthesization that minimizes the number of scalar multiplications.
 * The interval DP:
 *
 *   dp[i][j] = min over k of (dp[i][k] + dp[k+1][j] + p[i-1]·p[k]·p[j])
 *
 * where p[] holds the dimensions. Longer intervals are built from shorter
 * ones, hence "interval DP".
 *
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n³)
 *   Space: O(n²)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The interval being computed is YELLOW (comparing).
 *   - The split point k is PINK (highlight).
 *   - The optimal split is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The canonical interval-DP template.
 *   - The reconstruction of the parenthesization is a second pass.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The DP table (Infinity shown as ∞).
 * @param states Optional `row,col` → state overrides.
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        for (let col = 0; col < matrixRow.length; col += 1) {
            const value = matrixRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value === Infinity ? "∞" : String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
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

/**
 * The Matrix Chain generator.
 *
 * @param input `{ dims }` – the matrix dimensions p[0..n].
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { dims?: number[] } | null) ?? {};
    const dims = task.dims ?? [30, 35, 15, 5, 10];

    const n = dims.length - 1; // number of matrices
    let step = 0;

    // Edge case: fewer than two dimensions means no chain to parenthesize.
    if (n <= 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Need at least two dimensions (one matrix) to form a chain.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 0, cols: 0, minCost: 0 },
        };
        return;
    }

    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
    for (let i = 0; i < n; i += 1) {
        dp[i][i] = 0;
    }

    // Frame 0: the diagonal is zeroed.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Matrix chain with ${n} matrices, dimensions [${dims.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Interval DP: build longer intervals from shorter ones.
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            let best = Infinity;
            let bestK = -1;

            for (let k = i; k < j; k += 1) {
                const cost =
                    (dp[i]?.[k] ?? 0) +
                    (dp[k + 1]?.[j] ?? 0) +
                    (dims[i] ?? 0) * (dims[k + 1] ?? 0) * (dims[j + 1] ?? 0);
                if (cost < best) {
                    best = cost;
                    bestK = k;
                }

                const states = new Map<string, EntityState>([
                    [`${i},${j}`, "comparing"],
                    [`${i},${k}`, "highlight"],
                    [`${k + 1},${j}`, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dp, states),
                    edges: [],
                    description: `Interval [${i}, ${j}] split at k=${k} → cost ${cost}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { rows: n, cols: n },
                };
                step += 1;
            }

            dp[i][j] = best;

            const doneStates = new Map<string, EntityState>([[`${i},${j}`, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, doneStates),
                edges: [],
                description: `dp[${i}][${j}] = ${best} (best split k=${bestK}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: n, cols: n },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Minimum scalar multiplications = ${dp[0]?.[n - 1]}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n, cols: n, minCost: dp[0]?.[n - 1] },
    };
}

/** The Matrix Chain module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Matrix chain multiplication finds the parenthesization of a chain of matrices that minimizes scalar multiplications. The interval DP stores the minimum cost for multiplying matrices i through j. A split k combines the cost of the left and right subchains plus the cost of multiplying their resulting dimensions.",
        "invariants": [
            "dp[i][j] is the minimum cost to compute the product of matrices i..j.",
            "dp[i][i] is zero because one matrix needs no multiplication.",
            "Intervals are filled in increasing length so subchains are final."
        ],
        "correctness": "Any parenthesization performs a final multiplication combining results of subchains i..k and k+1..j, whose costs are independent and given by dp. Adding the dimension cost of that final product gives the total for the split, and minimizing over k chooses the best. Induction over interval length proves the table values.",
        "complexityRationale": "There are O(n^2) intervals and O(n) splits per interval, costing O(n^3) time. The cost table and split table use O(n^2) space.",
        "uses": [
            "Choosing evaluation order in numerical linear algebra",
            "Optimizing chained tensor or matrix products",
            "A canonical interval DP teaching example"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 15.2",
            "Golub and Van Loan, Matrix Computations, Chapter 1"
        ],
        "workedExample": "For dimensions [30,35,15,5,10] the DP compares all parenthesizations of four matrices. The optimum is ((A1A2)(A3A4)) costing 30*35*15 plus 15*5*10 plus 30*15*10 = 15125 multiplications."
    },
    id: "interval-matrix-chain",
    name: "Matrix Chain Multiplication",
    category: "dynamic-programming",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // The classic CLRS example: 4 matrices with dims [30,35,15,5,10].
    defaultInput: { dims: [30, 35, 15, 5, 10] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[i][i] <- 0 for single-matrix intervals",
        "dp[i][j] holds min multiplications for chain i..j",
        "dp[i][j] <- min over k of dp[i][k] + dp[k+1][j] + dims cost",
        "expand intervals by increasing chain length",
        "try every split k as the final multiplication point",
        "add left, right, and merge costs per split choice",
        "answer <- dp[0][n-1] with split tree from best-k picks",
    ],
};

export default module;
