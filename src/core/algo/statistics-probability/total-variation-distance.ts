/**
 * total-variation-distance.ts - Total Variation Distance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Total variation distance measures the gap between two discrete probability
 * distributions. It sums the absolute differences of their masses outcome by
 * outcome and halves the total, giving zero for identical distributions and one
 * for distributions with disjoint support.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n outcomes
 *   Space: O(n) for the displayed paired bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each outcome has two bars, one for each distribution.
 *   - The pair currently being compared is highlighted.
 *   - The final frame reports the total variation distance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(p: number[], q: number[], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < p.length; i += 1) {
        for (const [label, distribution, value] of [
            ["p", "p", p[i] ?? 0],
            ["q", "q", q[i] ?? 0],
        ] as Array<[string, string, number]>) {
            let state: EntityState = distribution === "p" ? "sorted" : "visited";
            if (!done && i === active) {
                state = "active";
            }
            entities.push({
                id: `${label}-${i}`,
                type: "bar" as const,
                label: `${label}=${value.toFixed(2)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: i, distribution, value },
            });
        }
    }
    return entities;
}

function normalize(values: number[]): number[] {
    const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
    return total > 0 ? values.map((value) => Math.max(0, value) / total) : values.map(() => 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number[]; q?: number[] } | null) ?? {};
    const p = normalize(Array.isArray(task.p) ? task.p.slice() : [0.5, 0.3, 0.2, 0]);
    const q = normalize(Array.isArray(task.q) ? task.q.slice() : [0.1, 0.4, 0.3, 0.2]);
    const n = Math.min(p.length, q.length);

    yield {
        stepNumber: 0,
        entities: makeBars(p, q, -1, false),
        edges: [],
        description: `Total variation distance between two distributions over ${n} outcome(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, absoluteTotal: 0, distance: 0 },
    };
    let step = 1;

    let absoluteTotal = 0;
    for (let i = 0; i < n; i += 1) {
        const difference = (p[i] ?? 0) - (q[i] ?? 0);
        absoluteTotal += Math.abs(difference);
        yield {
            stepNumber: step,
            entities: makeBars(p, q, i, false),
            edges: [],
            description: `Outcome ${i + 1}: masses ${(p[i] ?? 0).toFixed(3)} and ${(q[i] ?? 0).toFixed(3)}, absolute gap ${Math.abs(difference).toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, absoluteTotal, distance: 0 },
        };
        step += 1;
    }

    const distance = absoluteTotal / 2;
    yield {
        stepNumber: step,
        entities: makeBars(p, q, -1, true),
        edges: [],
        description: `Absolute total ${absoluteTotal.toFixed(4)}; total variation distance ${distance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, absoluteTotal, distance },
    };
}

/** The total variation distance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Total variation distance answers how much one probability distribution must be moved to become the other. It adds up the mismatched mass outcome by outcome and halves it, because every unit moved reduces the gap in two places at once.",
        invariants: [
            "Both distributions are normalized to sum to one before comparing.",
            "The absolute total is twice the total variation distance.",
            "The distance is symmetric in the two distributions.",
        ],
        correctness:
            "The sum of absolute differences over a common outcome set equals twice the maximum probability discrepancy over all events, because the event attaining the supremum collects exactly the positive differences. Halving therefore gives the total variation distance, which is zero only for identical distributions and one only for disjoint support.",
        complexityRationale:
            "One subtraction and one addition per outcome make the computation linear in n, and the paired bars use linear space.",
        uses: [
            "Bounding the difference between approximate and exact samplers",
            "Measuring distribution shift in machine learning",
            "Analyzing mixing rates of Markov chains",
        ],
        references: [
            "Levin, Peres and Wilmer, Markov Chains and Mixing Times, Chapter 4",
            "Cover and Thomas, Elements of Information Theory, Chapter 11",
        ],
        workedExample:
            "For p equals 0.5, 0.3, 0.2 and q equals 0.1, 0.4, 0.3, 0.2 the absolute gaps are 0.4, 0.1, 0.1 and 0, summing to 0.6. Half of that, 0.3, is the total variation distance.",
    },
    id: "total-variation-distance",
    name: "Total Variation Distance",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { p: [0.5, 0.3, 0.2, 0], q: [0.1, 0.4, 0.3, 0.2] },
    visualType: "array",
    run,
    pseudocode: [
        "read the two discrete distributions",
        "normalize each distribution so its masses sum to one",
        "initialize the absolute difference total to zero",
        "for each outcome add the absolute difference of the two masses",
        "halve the total to obtain the total variation distance",
        "done: report the total variation distance",
    ],
};

export default module;
