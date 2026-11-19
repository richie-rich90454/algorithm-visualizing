/**
 * dual-ascent.ts - Dual Ascent for the Continuous Knapsack Relaxation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dual ascent solves a convex optimization problem by raising a dual variable
 * as far as it can go while feasibility holds. For the continuous knapsack
 * problem (maximize sum v_i x_i subject to sum w_i x_i <= C, 0 <= x_i <= 1),
 * the Lagrangian dual has a single variable lambda >= 0 with objective
 * g(lambda) = C lambda + sum max(0, v_i - w_i lambda). This function is convex
 * and piecewise linear, so its minimum occurs at one of the breakpoints
 * lambda = v_i / w_i. Dual ascent walks those breakpoints upward and stops as
 * soon as the dual objective begins to increase. Strong duality makes the dual
 * minimum equal to the relaxed primal optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort breakpoints, O(n) per evaluation
 *   Space: O(n) for the item data
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per item shows its current dual contribution max(0, v - w*lambda).
 *   - The bar that becomes tight at the current breakpoint is highlighted.
 *   - The meta reports lambda, the dual value, and the primal optimum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DualAscentInput {
    values?: number[];
    weights?: number[];
    capacity?: number;
}

interface Item {
    value: number;
    weight: number;
}

/** Continuous knapsack optimum by greedy filling in ratio order. */
function primalOptimum(items: Item[], capacity: number): number {
    const ordered = [...items].sort((a, b) => b.value / b.weight - a.value / a.weight);
    let remaining = capacity;
    let total = 0;
    for (const item of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(1, remaining / item.weight);
        total += take * item.value;
        remaining -= take * item.weight;
    }
    return total;
}

function dualValue(items: Item[], capacity: number, lambda: number): number {
    return capacity * lambda + items.reduce((sum, item) => sum + Math.max(0, item.value - item.weight * lambda), 0);
}

function makeBars(items: Item[], lambda: number, tight: number): VisualEntity[] {
    return items.map((item, index) => {
        const contribution = Math.max(0, item.value - item.weight * lambda);
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `item${index}: ${contribution.toFixed(2)}`,
            value: contribution,
            state: (index === tight ? "comparing" : contribution <= 1e-9 ? "idle" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value: item.value, weight: item.weight, ratio: item.value / item.weight },
        };
    });
}

/** The dual ascent generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DualAscentInput | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0 ? task.values : [8, 7, 6, 4];
    const weights: number[] = Array.isArray(task.weights) && task.weights.length === values.length ? task.weights : [4, 3, 3, 2];
    const capacity = typeof task.capacity === "number" && task.capacity >= 0 ? task.capacity : 6;
    const items: Item[] = values
        .map((value, index) => ({ value, weight: weights[index] ?? 1 }))
        .filter((item) => item.weight > 0);
    const primal = primalOptimum(items, capacity);
    const breakpoints = [...new Set(items.map((item) => item.value / item.weight))]
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);

    let bestLambda = 0;
    let bestDual = dualValue(items, capacity, 0);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeBars(items, 0, -1),
        edges: [],
        description: `Minimizing the knapsack dual g(lambda) = C*lambda + sum max(0, v - w*lambda), C = ${capacity}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda: 0, dual: bestDual, primal, gap: primal - bestDual, iteration: 0, done: false },
    };

    let previous = bestDual;
    for (let i = 0; i < breakpoints.length; i += 1) {
        const lambda = breakpoints[i]!;
        const dual = dualValue(items, capacity, lambda);
        const tight = items.findIndex((item) => Math.abs(item.value / item.weight - lambda) < 1e-12);
        if (dual < previous - 1e-10) {
            bestLambda = lambda;
            bestDual = dual;
            previous = dual;
        } else {
            break;
        }
        yield {
            stepNumber: step++,
            entities: makeBars(items, lambda, tight),
            edges: [],
            description: `Breakpoint ${i + 1}: lambda = ${lambda.toFixed(4)}, dual value ${dual.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lambda, dual, primal, gap: primal - dual, iteration: i + 1, done: false },
        };
    }

    const finalDual = dualValue(items, capacity, bestLambda);
    yield {
        stepNumber: step,
        entities: makeBars(items, bestLambda, -1),
        edges: [],
        description: `Dual optimum ${finalDual.toFixed(4)} at lambda ${bestLambda.toFixed(4)} matches the primal optimum ${primal.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { lambda: bestLambda, dual: finalDual, primal, gap: primal - finalDual, iteration: breakpoints.length, done: true },
    };
}

/** The dual ascent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of filling a knapsack directly, dual ascent adjusts a price lambda for the capacity constraint. Raise the price and each item's profit shrinks; when an item's profit reaches zero the price cannot rise further without hurting the bound. The smallest bound over all prices equals the best possible relaxed filling, so watching the bound fall as lambda rises gives the same answer by a different route.",
        invariants: [
            "The dual value at any lambda is an upper bound on the primal optimum.",
            "The dual objective is convex and piecewise linear with breakpoints v_i / w_i.",
            "Dual feasibility holds because mu_i = max(0, v_i - w_i lambda) is nonnegative.",
            "The dual value decreases until the first breakpoint where it starts to rise.",
        ],
        correctness:
            "Weak duality gives g(lambda) >= primal optimum for every lambda >= 0 because each term max(0, v_i - w_i lambda) is at least v_i x_i for any feasible x. The dual is convex and piecewise linear, so its minimum lies at a breakpoint lambda = v_i / w_i. Walking breakpoints in increasing order and stopping at the first rise finds that minimum. Strong duality for this linear program makes the dual minimum equal to the continuous knapsack optimum, and the reported gap therefore falls to zero.",
        complexityRationale:
            "Sorting the n ratios costs O(n log n), and each breakpoint evaluation scans the n items for O(n) work. Storing the items and their breakpoints uses O(n) space.",
        uses: [
            "Lagrangian relaxation bounds for integer programs",
            "Resource allocation with a single shared budget",
            "Teaching the relationship between primal and dual linear programs",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, 2006",
            "Bertsekas, Convex Optimization Theory, 2009",
        ],
        workedExample:
            "With values (8, 7, 6, 4), weights (4, 3, 3, 2), and capacity 6, the greedy primal takes item 1 fully (value 7, weight 3) and three quarters of item 0 (value 6) for a total of 13. The dual breakpoints are 2 and 7/3; the minimum of g occurs at lambda = 2, giving g = 2*6 + 1 = 13. The primal and dual values agree, so the gap is zero.",
    },
    id: "dual-ascent",
    name: "Dual Ascent (Continuous Knapsack)",
    category: "numerical-optimization",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [8, 7, 6, 4], weights: [4, 3, 3, 2], capacity: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "form the dual g(lambda) = C lambda plus sum max(0, v - w lambda)",
        "compute the breakpoints lambda = v_i over w_i",
        "sort the breakpoints in increasing order",
        "evaluate g at lambda zero and at each breakpoint",
        "stop when g stops decreasing",
        "set mu_i to max(0, v_i - w_i lambda) for feasibility",
        "report the dual minimum and the primal optimum",
        "done: report lambda and the duality gap",
    ],
};

export default module;
