/**
 * cohens-kappa.ts - Cohen's Kappa for Inter-Rater Agreement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cohen's kappa measures how often two raters agree after subtracting the
 * agreement they would reach by chance. The module fills a square contingency
 * table from the paired ratings, computes the observed agreement po on the
 * diagonal, estimates chance agreement pe from the row and column marginals,
 * and reports kappa = (po - pe) / (1 - pe).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N + k^2) for N ratings and k categories
 *   Space: O(k^2) for the contingency grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each table cell shows how often a rating pair occurred.
 *   - The cell receiving the current rating is highlighted.
 *   - The final frame is green and reports kappa.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number];

function makeCells(table: number[][], current: Pair | null, done: boolean): VisualEntity[] {
    return table.flatMap((row, r) =>
        row.map((count, c) => {
            let state: EntityState = "idle";
            if (done) {
                state = c === r ? "sorted" : "unvisited";
            } else if (current && current[0] === r && current[1] === c) {
                state = "comparing";
            }
            return {
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(count),
                value: count,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count },
            };
        }),
    );
}

/** Build the contingency grid. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ratings?: Pair[]; categories?: number } | null) ?? {};
    const ratings: Pair[] = Array.isArray(task.ratings)
        ? task.ratings.map((pair) => [pair[0], pair[1]] as Pair)
        : [
              [0, 0], [0, 0], [0, 0], [0, 0],
              [0, 1], [0, 1],
              [1, 0], [1, 0], [1, 0],
              [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
              [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
          ];
    const maxRating = ratings.reduce((max, pair) => Math.max(max, pair[0], pair[1]), 0);
    const k = Math.max(1, Math.floor(task.categories ?? maxRating + 1));
    const table: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
    const N = ratings.length;

    yield {
        stepNumber: 0,
        entities: makeCells(table, null, false),
        edges: [],
        description: `Filling a ${k} by ${k} agreement table from ${N} rating pair(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { N, k, po: 0, pe: 0, kappa: 0 },
    };
    let step = 1;

    for (let i = 0; i < N; i += 1) {
        const pair = ratings[i];
        const r = Math.min(k - 1, Math.max(0, pair[0]));
        const c = Math.min(k - 1, Math.max(0, pair[1]));
        table[r][c] = (table[r][c] ?? 0) + 1;
        yield {
            stepNumber: step,
            entities: makeCells(table, [r, c], false),
            edges: [],
            description: `Rating ${i}: rater one chose category ${r}, rater two chose ${c}; cell count is now ${table[r][c]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { N, k, po: 0, pe: 0, kappa: 0 },
        };
        step += 1;
    }

    let diagonal = 0;
    for (let i = 0; i < k; i += 1) {
        diagonal += table[i][i] ?? 0;
    }
    const po = N === 0 ? 0 : diagonal / N;
    const rowTotals = table.map((row) => row.reduce((sum, value) => sum + value, 0));
    const colTotals = Array.from({ length: k }, (_, c) =>
        table.reduce((sum, row) => sum + (row[c] ?? 0), 0),
    );
    let pe = 0;
    if (N > 0) {
        for (let i = 0; i < k; i += 1) {
            pe += ((rowTotals[i] ?? 0) / N) * ((colTotals[i] ?? 0) / N);
        }
    }
    const denom = 1 - pe;
    const kappa = N === 0 ? 0 : Math.abs(denom) < 1e-12 ? (po >= 1 ? 1 : 0) : (po - pe) / denom;

    yield {
        stepNumber: step,
        entities: makeCells(table, null, true),
        edges: [],
        description: `Observed agreement ${po.toFixed(4)}, chance agreement ${pe.toFixed(4)}, Cohen's kappa ${kappa.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { N, k, po, pe, kappa, diagonal },
    };
}

/** The Cohen kappa module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two raters can agree just because one category is common. Cohen's kappa asks how much better they do than that baseline. It compares the fraction of cases where they match with the fraction they would match if each rater picked categories independently at the same rates, and keeps only the surplus agreement.",
        invariants: [
            "The contingency cell counts always sum to the number of rated cases.",
            "Observed agreement po is the diagonal total divided by the case count.",
            "Chance agreement pe is the dot product of the row and column proportions.",
        ],
        correctness:
            "Each rating pair increments exactly one table cell, so the diagonal counts the agreements and po is correct. Under independence the probability rater one chooses category i is its row proportion and rater two chooses i is its column proportion; their product summed over i is pe. Subtracting pe from po and dividing by the remaining room above chance gives kappa, which is one for perfect agreement and about zero for chance-level agreement.",
        complexityRationale:
            "Filling the table is one pass over N ratings, and the final marginals and products take O(k^2) time over the k by k cells. The table itself is the only O(k^2) storage.",
        uses: [
            "Measuring agreement between medical diagnosticians",
            "Validating labels in annotated machine-learning data sets",
            "Comparing two human coders in content analysis",
        ],
        references: [
            "Cohen, A Coefficient of Agreement for Nominal Scales, 1960",
            "Agresti, Analysis of Categorical Data, Chapter 2",
        ],
        workedExample:
            "With a 2 by 2 table of counts 4 and 11 on the diagonal, 2 in the upper right and 3 in the lower left, 15 of 20 cases agree so po is 0.75. The marginals give pe about 0.56, and kappa is about 0.43, indicating moderate agreement beyond chance.",
    },
    id: "cohens-kappa",
    name: "Cohen's Kappa",
    category: "statistics-probability",
    complexity: { time: "O(N + k^2)", space: "O(k^2)" },
    defaultInput: {
        ratings: [
            [0, 0], [0, 0], [0, 0], [0, 0],
            [0, 1], [0, 1],
            [1, 0], [1, 0], [1, 0],
            [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
            [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
        ],
        categories: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the paired ratings and the number of categories",
        "initialize a square contingency table of zeros",
        "for each rating pair increment the corresponding cell",
        "set po to the diagonal total divided by the case count",
        "compute each row proportion and each column proportion",
        "set pe to the sum of row proportion times column proportion",
        "set kappa to po minus pe over one minus pe",
        "done: report Cohen's kappa",
    ],
};

export default module;
