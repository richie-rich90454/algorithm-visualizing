/**
 * interpolation-neville.ts - Neville's Algorithm for Polynomial Interpolation.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Neville's algorithm builds a triangular table of interpolating polynomials.
 * P[i][0] is simply y[i], and each higher diagonal combines two earlier entries
 * with the interpolation point x. The bottom-right entry P[n-1][n-1] is the
 * unique degree-(n-1) polynomial through the points evaluated at x.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) to fill the triangular table
 *   Space: O(n^2) for the table (O(n) if only the last diagonal is kept)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid holds the triangular Neville table P[i][j].
 *   - Each frame reveals the next diagonal of the table.
 *   - The final frame highlights the bottom-right interpolated value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NevilleInput {
    xs?: number[];
    ys?: number[];
    x?: number;
}

function fmt(value: number): string {
    return Number.isFinite(value) ? value.toPrecision(8) : String(value);
}

/** Build the Neville table for the given nodes and evaluation point. */
function buildTable(xs: number[], ys: number[], x: number): number[][] {
    const n = xs.length;
    const table: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        table[i]![0] = ys[i] ?? 0;
    }
    for (let j = 1; j < n; j += 1) {
        for (let i = j; i < n; i += 1) {
            const left = table[i]![j - 1] ?? 0;
            const below = table[i - 1]![j - 1] ?? 0;
            table[i]![j] = ((x - (xs[i - j] ?? 0)) * left - (x - (xs[i] ?? 0)) * below)
                / ((xs[i] ?? 0) - (xs[i - j] ?? 0));
        }
    }
    return table;
}

function makeEntities(table: number[][], columns: number, done: boolean, n: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < table.length; i += 1) {
        for (let j = 0; j < columns; j += 1) {
            const value = table[i]![j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: fmt(value),
                value,
                state: (done && i === n - 1 && j === n - 1
                    ? "sorted"
                    : done
                        ? "idle"
                        : j === columns - 1
                            ? "highlight"
                            : "active") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NevilleInput | null) ?? {};
    const fallbackXs = [0, 1, 2, 3];
    const xs = Array.isArray(task.xs) && task.xs.length >= 2 ? task.xs.slice() : fallbackXs;
    const ys = Array.isArray(task.ys) && task.ys.length === xs.length
        ? task.ys.slice()
        : xs.map((v) => v * v * v - 2 * v + 5);
    const x = typeof task.x === "number" ? task.x : 1.5;
    const n = xs.length;
    const table = buildTable(xs, ys, x);

    yield {
        stepNumber: 0,
        entities: makeEntities(table, 1, false, n),
        edges: [],
        description: `Loaded ${n} interpolation nodes; column 0 holds the given y values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, columns: 1, n, x },
    };

    for (let j = 1; j < n; j += 1) {
        yield {
            stepNumber: j,
            entities: makeEntities(table, j + 1, false, n),
            edges: [],
            description: `Filled diagonal ${j}: each P[i][${j}] combines two entries from diagonal ${j - 1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols: n, columns: j + 1, n, x },
        };
    }

    const answer = table[n - 1]![n - 1] ?? 0;
    yield {
        stepNumber: n,
        entities: makeEntities(table, n, true, n),
        edges: [],
        description: `Done: the interpolating polynomial evaluated at x=${fmt(x)} is ${fmt(answer)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n, columns: n, n, x, value: answer },
    };
}

const module: AlgorithmModule = {
    id: "interpolation-neville",
    name: "Neville's Interpolation",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: {
        xs: [0, 1, 2, 3],
        ys: [5, 4, 9, 26],
        x: 1.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set P[i][0] to y[i] for every node i",
        "for each diagonal j from 1 to n-1",
        "for each row i from j to n-1",
        "set P[i][j] to ((x-x[i-j])P[i][j-1] - (x-x[i])P[i-1][j-1])/(x[i]-x[i-j])",
        "the entry P[n-1][n-1] is the interpolated value at x",
        "done: report the interpolated value",
    ],
    education: {
        intuition:
            "Rather than solving for polynomial coefficients, Neville's algorithm recursively combines small interpolants. P[i][j] is the degree-j polynomial that passes through nodes i-j through i. Two neighbouring degree-j polynomials are blended into a degree-(j+1) polynomial that also passes through one more node.",
        invariants: [
            "P[i][0] equals y[i] at every node.",
            "P[i][j] is the degree-j interpolant of the nodes i-j through i.",
            "Every P[i][j] agrees with the data at its defining nodes.",
            "The final bottom-right entry is the unique degree n-1 interpolant evaluated at x.",
        ],
        correctness:
            "The recursion is Newton's divided-difference identity rearranged for evaluation: the weighted average of two interpolants cancels the higher-order error term and produces the interpolant over the union of their node sets. By induction on j, P[i][j] interpolates its j+1 nodes, so P[n-1][n-1] interpolates all n nodes and equals the data polynomial at x.",
        complexityRationale:
            "The triangular table contains about n squared / 2 entries and each costs a constant number of arithmetic operations, giving O(n squared) time and O(n squared) space for the displayed table.",
        uses: [
            "Evaluating an interpolating polynomial without finding its coefficients",
            "Numerical analysis demos of Aitken and Neville interpolation",
            "Building blocks for Romberg integration and extrapolation methods",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, section on Neville's method",
            "Press et al., Numerical Recipes, chapter on interpolation",
        ],
        workedExample:
            "For the nodes (0,5), (1,4), (2,9), (3,26) which lie on x cubed minus 2x plus 5, evaluating at x=1.5 fills the table so the bottom-right entry is 1.5 cubed minus 3 plus 5, which is 5.375.",
    },
};

export default module;
