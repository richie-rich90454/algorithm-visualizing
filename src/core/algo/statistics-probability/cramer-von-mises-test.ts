/**
 * cramer-von-mises-test.ts - Cramer-von Mises Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Cramer-von Mises test measures how far an empirical distribution is from
 * a specified continuous distribution. For sorted observations it integrates
 * the squared gap between the empirical cumulative distribution and the model
 * cumulative distribution. That integral reduces to a finite sum over the data
 * points plus a small constant, giving the W-squared statistic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort the sample
 *   Space: O(n) for the sorted values and displayed rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid whose columns are the sorted observations.
 *   - Rows show the observation, model CDF, empirical target, and squared gap.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeCells(sorted: number[], cdf: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const n = sorted.length;
    const rows: Array<(i: number) => { label: string; value: number }> = [
        (i) => ({ label: sorted[i]!.toFixed(3), value: sorted[i]! }),
        (i) => ({ label: cdf[i]!.toFixed(3), value: cdf[i]! }),
        (i) => ({ label: ((2 * (i + 1) - 1) / (2 * n)).toFixed(3), value: (2 * (i + 1) - 1) / (2 * n) }),
        (i) => {
            const gap = cdf[i]! - (2 * (i + 1) - 1) / (2 * n);
            return { label: (gap * gap).toFixed(4), value: gap * gap };
        },
    ];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const shown = col < revealed;
            const cell = shown ? rows[row]!(col) : { label: "-", value: 0 };
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? (row === 3 ? (cell.value).toFixed(4) : cell.label) : "-",
                value: cell.value,
                state: shown ? (row === 3 ? "highlight" : "comparing") : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; a?: number; b?: number } | null) ?? {};
    const raw = Array.isArray(task.data) && task.data.length > 0 ? task.data.map(Number) : [0.12, 0.45, 0.30, 0.78, 0.56, 0.91, 0.23, 0.67];
    const a = typeof task.a === "number" ? task.a : Math.min(...raw);
    const b = typeof task.b === "number" && task.b > a ? task.b : Math.max(...raw);
    const sorted = [...raw].sort((x, y) => x - y);
    const n = sorted.length;
    const cdf = sorted.map((x) => Math.min(1, Math.max(0, (x - a) / (b - a))));
    let w2 = 1 / (12 * n);
    for (let i = 0; i < n; i += 1) {
        const target = (2 * (i + 1) - 1) / (2 * n);
        w2 += (cdf[i]! - target) ** 2;
    }

    yield {
        stepNumber: 0,
        entities: makeCells(sorted, cdf,0),
        edges: [],
        description: `Test ${n} observations against a uniform distribution on [${a.toFixed(3)}, ${b.toFixed(3)}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: n, n, a, b, w2: 0 },
    };
    let step = 1;
    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(sorted, cdf,i + 1),
            edges: [],
            description: `Observation ${i + 1}: x = ${sorted[i]!.toFixed(3)}, model CDF ${cdf[i]!.toFixed(3)}, empirical target ${((2 * (i + 1) - 1) / (2 * n)).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 4, cols: n, n, a, b, w2: 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(sorted, cdf,n),
        edges: [],
        description: `Cramer-von Mises W-squared = ${w2.toFixed(5)}; smaller values mean a closer fit.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 4, cols: n, n, a, b, w2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plot the empirical cumulative distribution of the data against the cumulative curve of a proposed model. If the model is right the two curves overlap. The Cramer-von Mises statistic adds up the squared vertical gaps everywhere between them, so it is sensitive to discrepancies across the whole range rather than only at the single worst point.",
        invariants: [
            "Observations are processed in sorted order.",
            "The empirical target for the i-th sorted value is (2i-1)/(2n).",
            "The statistic is nonnegative and includes the 1/(12n) constant.",
        ],
        correctness:
            "For continuous data the empirical cumulative function F_n is a step function with jumps at the sorted observations. The integral of (F_n - F)^2 from a to b splits into integrals over consecutive intervals; within each interval F_n is constant, so the integral is the squared gap times the width, and the width in probability scale telescopes to the target spacing 1/n. Summing yields the displayed finite expression plus the constant 1/(12n), which is exactly the Cramer-von Mises W-squared statistic.",
        complexityRationale:
            "Sorting the sample dominates at O(n log n). Evaluating the n CDF values and the sum is linear, and the displayed rows use O(n) space.",
        uses: [
            "Testing whether data follow a specified continuous distribution",
            "Checking the uniformity of random-number generators",
            "A general goodness-of-fit alternative to the Kolmogorov-Smirnov test",
        ],
        references: [
            "Cramer, On the Composition of Elementary Errors, 1928",
            "von Mises, WahrscheinlichkeitStatistik und Wahrheit, 1928",
        ],
        workedExample:
            "For data (0.12, 0.45, 0.30, 0.78, 0.56, 0.91, 0.23, 0.67) on [0,1], sorting gives ranks whose model CDF values are close to (2i-1)/(16). The squared gaps are tiny, so W-squared is small, consistent with a uniform sample.",
    },
    id: "cramer-von-mises-test",
    name: "Cramer-von Mises Test",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { data: [0.12, 0.45, 0.30, 0.78, 0.56, 0.91, 0.23, 0.67], a: 0, b: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the observations from smallest to largest",
        "compute the model CDF at each sorted value",
        "compute the empirical target (2i-1)/(2n) for each rank",
        "square the gap between model CDF and target",
        "sum the squared gaps over all observations",
        "add the constant 1/(12n) to obtain W squared",
        "report W squared as the goodness-of-fit statistic",
    ],
};

export default module;
