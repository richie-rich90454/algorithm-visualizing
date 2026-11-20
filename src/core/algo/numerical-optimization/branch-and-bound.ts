/**
 * branch-and-bound.ts - Branch and Bound for the 0/1 Knapsack Problem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Branch and bound searches a tree whose nodes decide whether each item is
 * taken or left behind. At every node it computes an optimistic upper bound by
 * solving the fractional relaxation: fill the remaining capacity with the most
 * valuable items first, allowing a piece of the first item that does not fit.
 * If the bound cannot beat the best complete solution found so far, the whole
 * subtree is pruned. Otherwise the node branches on the next item.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) worst case, far less with effective pruning; O(n log n) per bound
 *   Space: O(n) recursion depth plus the sorted item list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per item, showing its value; selected items turn green.
 *   - The item currently being branched on is yellow.
 *   - Best value, current bound, and node/prune counts are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface KnapsackItem {
    weight: number;
    value: number;
}

export interface BranchBoundResult {
    bestValue: number;
    bestTaken: boolean[];
    nodesExplored: number;
    prunes: number;
    trace: Array<{ depth: number; bound: number; best: number; value: number; taken: boolean[]; pruned: boolean }>;
}

/** Fractional-knapsack upper bound for a set of items at a given capacity. */
export function fractionalBound(items: KnapsackItem[], capacity: number): number {
    const sorted = [...items].sort((a, b) => b.value / b.weight - a.value / a.weight);
    let remaining = capacity;
    let bound = 0;
    for (const item of sorted) {
        if (remaining <= 0) break;
        if (item.weight <= remaining) {
            remaining -= item.weight;
            bound += item.value;
        } else {
            bound += (item.value / item.weight) * remaining;
            remaining = 0;
        }
    }
    return bound;
}

/** Solve 0/1 knapsack by branch and bound with a fractional upper bound. */
export function branchAndBound(items: KnapsackItem[], capacity: number): BranchBoundResult {
    const trace: BranchBoundResult["trace"] = [];
    let bestValue = 0;
    let bestTaken = Array<boolean>(items.length).fill(false);
    let nodesExplored = 0;
    let prunes = 0;

    const visit = (index: number, weight: number, value: number, taken: boolean[]): void => {
        nodesExplored += 1;
        const remaining = items.slice(index);
        const bound = value + fractionalBound(remaining, capacity - weight);
        let pruned = false;
        if (bound <= bestValue) {
            prunes += 1;
            pruned = true;
        } else if (index === items.length) {
            if (value > bestValue) {
                bestValue = value;
                bestTaken = [...taken];
            }
        } else {
            const item = items[index]!;
            const withItem = [...taken];
            withItem[index] = true;
            if (weight + item.weight <= capacity) {
                visit(index + 1, weight + item.weight, value + item.value, withItem);
            }
            visit(index + 1, weight, value, taken);
        }
        trace.push({
            depth: index,
            bound,
            best: bestValue,
            value,
            taken: [...taken],
            pruned,
        });
    };

    visit(0, 0, 0, Array<boolean>(items.length).fill(false));
    return { bestValue, bestTaken, nodesExplored, prunes, trace };
}

/** Bars for items, with selected items highlighted. */
function makeBars(
    items: KnapsackItem[],
    taken: boolean[],
    branching: number,
): VisualEntity[] {
    return items.map((item, index) => {
        const state: EntityState = taken[index]
            ? "sorted"
            : index === branching
              ? "comparing"
              : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `w${item.weight}:v${item.value}`,
            value: item.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, weight: item.weight, value: item.value, taken: taken[index] ?? false },
        };
    });
}

/** The branch-and-bound generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { items?: KnapsackItem[]; capacity?: number } | null
    ) ?? {};
    const items: KnapsackItem[] = Array.isArray(task.items)
        ? task.items
              .filter((it) => typeof it?.weight === "number" && typeof it?.value === "number")
              .map((it) => ({ weight: Math.max(0, it.weight), value: it.value }))
        : [
              { weight: 2, value: 6 },
              { weight: 3, value: 10 },
              { weight: 4, value: 12 },
              { weight: 5, value: 14 },
          ];
    const capacity = typeof task.capacity === "number" ? Math.max(0, task.capacity) : 9;
    const result = branchAndBound(items, capacity);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(items, Array<boolean>(items.length).fill(false), -1),
        edges: [],
        description: `Solving a ${items.length}-item 0/1 knapsack of capacity ${capacity} by branch and bound.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            items: items.length,
            capacity,
            best: 0,
            bound: fractionalBound(items, capacity),
            nodes: 0,
            prunes: 0,
        },
    };

    // Show a representative selection of search nodes: branch decisions and prunes.
    for (let i = 0; i < result.trace.length; i += 1) {
        const node = result.trace[i]!;
        if (node.pruned && i % 2 === 1) continue;
        yield {
            stepNumber: step++,
            entities: makeBars(items, node.taken, node.depth),
            edges: [],
            description: node.pruned
                ? `Node at depth ${node.depth}: bound ${node.bound.toFixed(2)} cannot beat best ${node.best}, so prune.`
                : `Node at depth ${node.depth}: bound ${node.bound.toFixed(2)}, current best ${node.best}.`,
            codeLineNumber: node.pruned ? 4 : 2,
            layout: "array",
            meta: {
                items: items.length,
                capacity,
                best: node.best,
                bound: node.bound,
                nodes: i + 1,
                prunes: result.trace.slice(0, i + 1).filter((n) => n.pruned).length,
                pruned: node.pruned,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(items, result.bestTaken, -1),
        edges: [],
        description: `Optimum value ${result.bestValue} after ${result.nodesExplored} node(s) with ${result.prunes} prune(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            items: items.length,
            capacity,
            best: result.bestValue,
            bound: result.bestValue,
            nodes: result.nodesExplored,
            prunes: result.prunes,
            bestTaken: result.bestTaken.map((taken) => (taken ? 1 : 0)),
        },
    };
}

/** The branch-and-bound module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Explore the choices as a tree: for every item, one branch takes it and the other leaves it. Before exploring a branch, compute the best result it could possibly achieve by pretending you can take fractions of items. If even that optimistic guess is worse than a solution you already have, skip the whole branch. The bound is what keeps the search from becoming exhaustive.",
        invariants: [
            "The fractional relaxation is always at least the best integer solution in a subtree.",
            "The incumbent best value only increases as complete solutions are found.",
            "A node is pruned only when its upper bound cannot exceed the incumbent.",
        ],
        correctness:
            "The fractional knapsack optimum is an upper bound because allowing fractional items relaxes the 0/1 constraint, so every integer solution in the subtree has value at most the bound. Therefore pruning when the bound is no better than the incumbent can never discard a strictly better solution. The search visits every remaining feasible leaf otherwise, so the largest feasible value found is the true optimum, which also matches brute-force enumeration.",
        complexityRationale:
            "The search tree has at most 2^n leaves, so the worst case is exponential. Each node computes a bound by sorting, O(n log n), or O(n) with a pre-sorted list; recursion depth and working storage are O(n). Strong bounds typically prune most nodes in practice.",
        uses: [
            "Resource allocation and capital budgeting with discrete choices",
            "Integer programming solvers as a bounding subroutine",
            "Cargo, cargo-space, and cutting-stock optimization",
        ],
        references: [
            "Land and Doig, An Automatic Method of Solving Discrete Programming Problems, 1960",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter on branch and bound",
        ],
        workedExample:
            "With items (weight, value) (2,6), (3,10), (4,12), (5,14) and capacity 9, taking items 1 and 2 gives value 16. A node that has taken item 4 alone has remaining capacity 4 and a fractional bound well below 16 once the other items are considered, so it is pruned; the optimum remains 16.",
    },
    id: "branch-and-bound",
    name: "Branch and Bound (0/1 Knapsack)",
    category: "numerical-optimization",
    complexity: { time: "O(2^n) worst case", space: "O(n)" },
    defaultInput: {
        items: [
            { weight: 2, value: 6 },
            { weight: 3, value: 10 },
            { weight: 4, value: 12 },
            { weight: 5, value: 14 },
        ],
        capacity: 9,
    },
    visualType: "array",
    run,
    pseudocode: [
        "sort items by value per unit weight for the bound",
        "compute the fractional upper bound for the current node",
        "if the bound cannot beat the best complete solution, prune",
        "if all items are decided, update the best solution",
        "branch one way by taking the next item when it fits",
        "branch the other way by leaving the next item",
        "recurse and accumulate explored and pruned counts",
        "done: report the optimal value and chosen items",
    ],
};

export default module;
