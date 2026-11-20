/**
 * knapsack-fractional.ts - Fractional Knapsack
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Unlike the 0/1 version, an item may be taken partly. Sort the items by value
 * per unit of weight and fill the knapsack greedily: take each item whole while
 * it fits, then take the largest possible fraction of the first item that does
 * not. A zero-weight item is always taken because it adds value for free.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the ratio sort
 *   Space: O(n) for the sorted order and the taken fractions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bar height encodes value per unit weight; the label shows v/w.
 *   - Fully taken items turn GREEN (sorted), the split item YELLOW (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Total weight never exceeds capacity.
 *   - Every fully taken item has a ratio at least as large as any skipped one.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    values: number[],
    weights: number[],
    ratios: number[],
    order: number[],
    taken: number[],
    current: number,
): VisualEntity[] {
    if (order.length === 0) {
        return [
            {
                id: "bar-empty",
                type: "bar" as const,
                label: "empty",
                value: 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { item: 0, value: 0, weight: 0, position: 0 },
            },
        ];
    }
    return order.map((item, position) => {
        const fraction = taken[item] ?? 0;
        let state: EntityState = "idle";
        if (fraction >= 1 - 1e-9) state = "sorted";
        else if (fraction > 0) state = "active";
        else if (item === current) state = "comparing";
        return {
            id: `bar-${item}`,
            type: "bar" as const,
            label: weights[item] === 0 ? "free" : `${values[item]}/${weights[item]}`,
            value: ratios[item] as number,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { item, value: values[item] as number, weight: weights[item] as number, position },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { values?: number[]; weights?: number[]; capacity?: number } | null
    ) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? task.values.map((v) => Number(v))
        : [60, 100, 120];
    const weights: number[] = Array.isArray(task.weights)
        ? task.weights.map((w) => Number(w))
        : [10, 20, 30];
    const n = Math.min(values.length, weights.length);
    const capacity = typeof task.capacity === "number" ? Math.max(0, task.capacity) : 50;

    const finiteRatios = values
        .slice(0, n)
        .map((v, i) => ((weights[i] as number) === 0 ? 0 : v / (weights[i] as number)))
        .filter((r) => Number.isFinite(r));
    const ceiling = finiteRatios.length > 0 ? Math.max(...finiteRatios) * 2 + 1 : 1;
    const ratios = values
        .slice(0, n)
        .map((v, i) => ((weights[i] as number) === 0 ? ceiling : v / (weights[i] as number)));
    const order = Array.from({ length: n }, (_v, i) => i).sort(
        (a, b) => (ratios[b] as number) - (ratios[a] as number) || a - b,
    );
    const taken = new Array<number>(n).fill(0);
    let remaining = capacity;
    let totalValue = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, weights, ratios, order, taken, -1),
        edges: [],
        description: `Filling a knapsack of capacity ${capacity} greedily by value-to-weight ratio.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { totalValue: 0, capacity, taken: [...taken], order: [...order] },
    };
    step += 1;

    for (const item of order) {
        const weight = weights[item] as number;
        if (remaining <= 1e-9) break;
        if (weight <= 0) {
            taken[item] = 1;
            totalValue += values[item] as number;
        } else if (weight <= remaining) {
            taken[item] = 1;
            totalValue += values[item] as number;
            remaining -= weight;
        } else {
            const fraction = remaining / weight;
            taken[item] = fraction;
            totalValue += fraction * (values[item] as number);
            remaining = 0;
        }
        yield {
            stepNumber: step,
            entities: makeBars(values, weights, ratios, order, taken, item),
            edges: [],
            description: `Item ${item}: took ${(taken[item] as number).toFixed(2)}, value now ${totalValue.toFixed(2)}, capacity left ${remaining.toFixed(2)}.`,
            codeLineNumber: (taken[item] as number) >= 1 - 1e-9 ? 3 : 4,
            layout: "array",
            meta: {
                totalValue: Number(totalValue.toFixed(6)),
                remaining: Number(remaining.toFixed(6)),
                taken: [...taken],
                order: [...order],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, weights, ratios, order, taken, -1),
        edges: [],
        description: `Done: maximum fractional value ${totalValue.toFixed(2)} with ${remaining.toFixed(2)} capacity unused.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { totalValue: Number(totalValue.toFixed(6)), remaining: Number(remaining.toFixed(6)), taken: [...taken], order: [...order] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Value per unit of weight tells you which items give the most benefit for the space they consume. Take the densest items first and you never need to split more than one item: once a fraction fills the remaining capacity, the knapsack is full.",
        invariants: [
            "Items are considered in nonincreasing value-to-weight ratio.",
            "The used weight never exceeds the capacity.",
            "Only the item that closes the gap may have a fractional take amount.",
        ],
        correctness:
            "If a feasible solution leaves capacity for a denser item while including a less dense one, swapping a small amount from the less dense to the denser item increases total value, so an optimum cannot do that. Greedily taking items in ratio order therefore reaches the optimum, and at most one split item is needed to stop exactly at capacity.",
        complexityRationale:
            "Sorting the n items by ratio costs O(n log n), and the single fill pass costs O(n); the ratios, order and fractions use O(n) space.",
        uses: [
            "Resource allocation where quantities are divisible",
            "Portfolio weight selection with continuous positions",
            "A contrast case against the 0/1 knapsack dynamic program",
        ],
        references: [
            "CLRS, Chapter 16, fractional knapsack section",
            "Karp, Reducibility Among Combinatorial Problems, 1972",
        ],
        workedExample:
            "With capacity 50 and items (value 60, weight 10), (100, 20), (120, 30), the ratios are 6, 5 and 4. Take the first two whole for 160 and 30 used weight, then take 20/30 of the third for 80 more, giving 240.",
    },
    id: "knapsack-fractional",
    name: "Fractional Knapsack",
    category: "dynamic-programming",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [60, 100, 120], weights: [10, 20, 30], capacity: 50 },
    visualType: "array",
    run,
    pseudocode: [
        "compute each item's value divided by its weight",
        "sort items by decreasing value-to-weight ratio",
        "set remaining capacity to the knapsack limit",
        "for each item in sorted order",
        "take it whole when its weight fits in the remaining capacity",
        "otherwise take the fraction that fills the remaining capacity",
        "add the taken value and stop once capacity is exhausted",
        "done: report the maximum total value",
    ],
};

export default module;
