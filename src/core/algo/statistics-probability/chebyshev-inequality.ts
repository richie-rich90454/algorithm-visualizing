/**
 * chebyshev-inequality.ts - Chebyshev's Inequality
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chebyshev's inequality bounds how much probability mass can sit far from the
 * mean. For a random variable with mean mu and standard deviation sigma, the
 * fraction of outcomes at least k standard deviations away is never more than
 * 1/k^2. Unlike a normal-based rule of thumb, the bound needs no shape
 * assumption about the distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for n data points and m thresholds
 *   Space: O(m) for the per-threshold results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row per threshold shows k, the empirical tail fraction, and 1/k^2.
 *   - The row being checked is yellow; verified rows are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    data?: number[];
    ks?: number[];
}

/** Build one grid row per threshold: k, empirical fraction, and bound. */
function makeCells(
    ks: number[],
    empiricals: Array<number | null>,
    bounds: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < ks.length; row += 1) {
        const value = empiricals[row];
        const columns = [
            { label: `k=${ks[row]?.toFixed(2)}`, value: ks[row] ?? 0 },
            { label: value === null || value === undefined ? "-" : value.toFixed(3), value: value ?? 0 },
            { label: (bounds[row] ?? 0).toFixed(3), value: bounds[row] ?? 0 },
        ];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done || row < current) state = "sorted";
            if (row === current && !done) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: columns[col]?.label ?? "",
                value: columns[col]?.value ?? 0,
                state,
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

/** The Chebyshev inequality generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 0 ? task.data.map(Number) : [2, 3, 3, 4, 4, 5, 9, 1];
    const ks = Array.isArray(task.ks) && task.ks.length > 0 ? task.ks.map(Number).filter((k) => k > 0) : [1, 1.5, 2, 3];

    const n = data.length;
    const mean = data.reduce((sum, x) => sum + x, 0) / n;
    const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const bounds = ks.map((k) => 1 / (k * k));
    const empiricals: Array<number | null> = ks.map(() => null);

    const summary = (k: number, empirical: number | null, bound: number) => ({
        rows: ks.length,
        cols: 3,
        n,
        mean,
        std,
        k,
        empirical: empirical ?? 0,
        bound,
        violations: 0,
        ks: ks.slice(),
        bounds: bounds.slice(),
        empiricals: empiricals.map((value) => value ?? 0),
    });

    yield {
        stepNumber: 0,
        entities: makeCells(ks, empiricals, bounds, -1, false),
        edges: [],
        description: `Checking Chebyshev's bound on ${n} values with mean ${mean.toFixed(2)} and standard deviation ${std.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(0, null, 0),
    };
    let step = 1;
    let violations = 0;

    for (let i = 0; i < ks.length; i += 1) {
        const k = ks[i] ?? 1;
        let count = 0;
        if (std > 0) {
            for (const value of data) {
                if (Math.abs(value - mean) >= k * std) count += 1;
            }
        }
        const empirical = count / n;
        const bound = bounds[i] ?? 0;
        empiricals[i] = empirical;
        if (empirical > bound + 1e-12) violations += 1;
        yield {
            stepNumber: step,
            entities: makeCells(ks, empiricals, bounds, i, false),
            edges: [],
            description: `k=${k.toFixed(2)}: ${count} of ${n} values are at least ${(k * std).toFixed(2)} from the mean, fraction ${empirical.toFixed(3)} <= bound ${bound.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...summary(k, empirical, bound), violations },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(ks, empiricals, bounds, ks.length - 1, true),
        edges: [],
        description: violations === 0
            ? `All ${ks.length} thresholds satisfy Chebyshev's bound; no violations found.`
            : `Found ${violations} threshold(s) violating the bound, indicating a computation error.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...summary(ks[ks.length - 1] ?? 0, empiricals[empiricals.length - 1] ?? 0, bounds[bounds.length - 1] ?? 0), violations },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The mean tells you the center and the standard deviation tells you the typical spread. Chebyshev turns those two numbers into a guarantee: no more than 1/k squared of the data can lie k standard deviations or more from the mean. It is deliberately loose but works for every distribution with a finite variance.",
        invariants: [
            "The empirical tail fraction always lies between zero and one.",
            "For every tested threshold, the empirical fraction never exceeds 1/k squared.",
            "The bound shrinks quadratically as k grows.",
        ],
        correctness:
            "Let A be the event that the absolute deviation from the mean is at least k sigma. Its indicator is at most (X-mu)^2/(k^2 sigma^2) whenever A occurs, so taking expectations gives P(A) <= E[(X-mu)^2]/(k^2 sigma^2) = 1/k^2. The generator computes exactly that empirical probability by counting, so the comparison performed at each threshold is the inequality itself.",
        complexityRationale:
            "Computing the mean and variance scans the n values twice, and each of the m thresholds rescans all n values, giving O(n*m) time. Only the m result triples are stored, so space is O(m).",
        uses: [
            "Distribution-free outlier flagging when the data shape is unknown",
            "Concentration proofs for randomized algorithms",
            "Conservative confidence statements in quality control",
        ],
        references: [
            "Chebyshev, Sur les valeurs limites des integrales, 1867",
            "Grimmett and Stirzaker, Probability and Random Processes, Chapter 3",
        ],
        workedExample:
            "For values 2,3,3,4,4,5,9,1 the mean is 3.875 and the population standard deviation is about 2.06. At k=2 the bound is 0.25; only the value 9 is more than 4.12 from the mean, so the empirical fraction 0.125 is well below the bound.",
    },
    id: "chebyshev-inequality",
    name: "Chebyshev Inequality",
    category: "statistics-probability",
    complexity: { time: "O(n*m)", space: "O(m)" },
    defaultInput: { data: [2, 3, 3, 4, 4, 5, 9, 1], ks: [1, 1.5, 2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the mean and standard deviation of the data",
        "for each positive threshold k",
        "count values at least k standard deviations from the mean",
        "set the empirical probability to that count divided by n",
        "compute the Chebyshev bound one over k squared",
        "check that the empirical probability is at most the bound",
        "done: report each threshold, empirical probability, and bound",
    ],
};

export default module;
