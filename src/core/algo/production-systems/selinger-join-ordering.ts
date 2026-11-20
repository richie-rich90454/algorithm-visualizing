/**
 * selinger-join-ordering.ts - Selinger Dynamic Programming Join Ordering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A relational optimizer must choose in which order to join relations, because
 * intermediate result sizes can differ by orders of magnitude. The Selinger
 * (System R) dynamic program enumerates every subset of relations and keeps the
 * cheapest way to produce it. Combining two subsets costs the sum of their
 * costs plus the size of the resulting Cartesian-filtered product. The optimum
 * for the full set is read off after all subsets are solved.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(3^n) subset and split enumeration for n relations
 *   Space: O(2^n) cost and split tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per nonempty subset shows that subset's minimum join cost.
 *   - The subset being solved is yellow; solved subsets are green.
 *   - The final frame reports the optimal left-to-right join order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface JoinInput {
    cardinalities?: number[];
    selectivity?: number;
}

function popcount(mask: number): number {
    let count = 0;
    let m = mask;
    while (m > 0) {
        m &= m - 1;
        count += 1;
    }
    return count;
}

/** Build bars for the subset cost table. */
function makeBars(costs: number[], current: number, done: boolean): VisualEntity[] {
    return costs.map((cost, mask) => {
        let state: EntityState = "idle";
        if (mask === 0) state = "idle";
        else if (done || mask < current) state = "sorted";
        else if (mask === current) state = "comparing";
        return {
            id: `bar-${mask}`,
            type: "bar" as const,
            label: `${mask.toString(2).padStart(4, "0")}: ${cost.toFixed(0)}`,
            value: cost,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { mask, size: popcount(mask) },
        };
    });
}

/** The Selinger join-ordering generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as JoinInput | null) ?? {};
    const card = Array.isArray(task.cardinalities) && task.cardinalities.length >= 1 && task.cardinalities.length <= 8
        ? task.cardinalities.map(Number).map((c) => Math.max(1, c))
        : [100, 40, 25, 15];
    const selectivity = typeof task.selectivity === "number" ? Math.min(1, Math.max(0.0001, task.selectivity)) : 0.1;
    const n = card.length;
    const limit = 1 << n;

    const cardinality = new Array<number>(limit).fill(1);
    for (let mask = 1; mask < limit; mask += 1) {
        let value = 1;
        for (let i = 0; i < n; i += 1) {
            if (mask & (1 << i)) value *= card[i] as number;
        }
        for (let i = 0; i < n; i += 1) {
            if (!(mask & (1 << i))) continue;
            for (let j = i + 1; j < n; j += 1) {
                if (mask & (1 << j)) value *= selectivity;
            }
        }
        cardinality[mask] = value;
    }

    const costs = new Array<number>(limit).fill(0);
    const bestSplit = new Array<number>(limit).fill(0);
    for (let mask = 1; mask < limit; mask += 1) {
        if (popcount(mask) < 2) continue;
        let best = Infinity;
        let bestLeft = 0;
        let sub = (mask - 1) & mask;
        while (sub > 0) {
            const other = mask ^ sub;
            if (other > 0) {
                const cost = (costs[sub] as number) + (costs[other] as number) + (cardinality[mask] as number);
                if (cost < best) {
                    best = cost;
                    bestLeft = sub;
                }
            }
            sub = (sub - 1) & mask;
        }
        costs[mask] = best;
        bestSplit[mask] = bestLeft;
    }

    const order: number[] = [];
    function reconstruct(mask: number): void {
        if (mask === 0) return;
        if (popcount(mask) === 1) {
            order.push(Math.log2(mask));
            return;
        }
        const left = bestSplit[mask] as number;
        reconstruct(left);
        reconstruct(mask ^ left);
    }
    reconstruct(limit - 1);
    const bestCost = costs[limit - 1] as number;

    const subsetMasks: number[] = [];
    const subsetCosts: number[] = [];
    for (let mask = 1; mask < limit; mask += 1) {
        subsetMasks.push(mask);
        subsetCosts.push(costs[mask] as number);
    }

    yield {
        stepNumber: 0,
        entities: makeBars(costs, -1, false),
        edges: [],
        description: `Selinger join ordering for ${n} relations with selectivity ${selectivity}; enumerate all ${limit - 1} nonempty subsets.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, subsets: limit - 1, bestCost, bestOrder: order, subsetMasks, subsetCosts, cardinalityTable: cardinality, currentMask: 0 },
    };
    let step = 1;

    for (let mask = 1; mask < limit; mask += 1) {
        const size = popcount(mask);
        yield {
            stepNumber: step,
            entities: makeBars(costs, mask, false),
            edges: [],
            description: size < 2
                ? `Subset ${mask.toString(2)} is a single relation with cost 0 and cardinality ${cardinality[mask]}.`
                : `Solved subset ${mask.toString(2)}: best split ${(bestSplit[mask] as number).toString(2)}, minimum cost ${(costs[mask] as number).toFixed(0)}.`,
            codeLineNumber: size < 2 ? 1 : 3,
            layout: "array",
            meta: { n, subsets: limit - 1, bestCost, bestOrder: order, subsetMasks, subsetCosts, cardinalityTable: cardinality, currentMask: mask },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(costs, limit, true),
        edges: [],
        description: `Optimal join order ${order.map((i) => `R${i}`).join(" then ")} with total cost ${bestCost.toFixed(0)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, subsets: limit - 1, bestCost, bestOrder: order, subsetMasks, subsetCosts, cardinalityTable: cardinality, currentMask: limit - 1, complete: true },
    };
}

/** The Selinger module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Joining two large relations before filtering them can create a huge temporary table. The optimizer solves every subproblem once: for each subset of relations it records the cheapest way to build that subset. It then combines smaller solved subsets, keeping the split with the lowest estimated cost, until it knows the best plan for all relations together.",
        invariants: [
            "The cost stored for a subset is the minimum over all its two-way splits.",
            "A subset's cardinality depends only on its base sizes and internal selectivities.",
            "Every proper submask is solved before the mask that uses it.",
        ],
        correctness:
            "Any binary join tree over a subset has a root that splits the subset into two smaller disjoint parts, each of which is itself an optimal or suboptimal plan for its part. Because every proper submask is strictly smaller as an integer, the dynamic program has already computed the true minimum for both parts before evaluating the root, so taking the minimum over all splits yields the global optimum by induction on subset size.",
        complexityRationale:
            "There are two to the n subsets and each examines up to two to the n submasks, giving three to the n split evaluations in total. Storing one cost and one chosen split per subset uses O(2 to the n) space.",
        uses: [
            "Choosing join plans in relational query optimizers",
            "Estimating intermediate result sizes for cost-based planning",
            "Teaching dynamic programming over bitmasks",
        ],
        references: [
            "Selinger et al., Access Path Selection in a Relational Database Management System, 1979",
            "Garcia-Molina, Ullman, and Widom, Database Systems: The Complete Book, Chapter 15",
        ],
        workedExample:
            "With four relations sized 100, 40, 25, and 15 and a join selectivity of 0.1, joining the two smallest first yields a small intermediate that is then joined with the larger relations. The dynamic program records the cost of every subset and reconstructs the ordering that keeps intermediate products smallest.",
    },
    id: "selinger-join-ordering",
    name: "Selinger Join Ordering",
    category: "production-systems",
    complexity: { time: "O(3^n)", space: "O(2^n)" },
    defaultInput: { cardinalities: [100, 40, 25, 15], selectivity: 0.1 },
    visualType: "array",
    run,
    pseudocode: [
        "read base cardinalities and the join selectivity",
        "compute the estimated cardinality of every subset",
        "initialize all subset costs to infinity",
        "for each subset with two or more relations",
        "for every split into two nonempty parts",
        "keep the split minimizing the combined cost",
        "reconstruct the optimal join order recursively",
        "done: report the best order and total cost",
    ],
};

export default module;
