/**
 * auction-algorithm-assignment.ts - Auction Algorithm for Assignment
 *
 * Rows bid for columns using prices. A bidder picks its best profit column,
 * raises that column's price by the gap to its second-best column plus one,
 * and takes ownership; the displaced bidder becomes free again. Scaling the
 * profits by n+1 makes an epsilon of one tight enough for an optimal result.
 *
 * Time: O(n^3) bids in the worst case. Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { costs?: number[][] };

function makeCells(
    costs: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < costs.length; row += 1) {
        const line = costs[row] ?? [];
        for (let col = 0; col < line.length; col += 1) {
            const value = line[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: String(value),
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const costs = (Array.isArray(task.costs) ? task.costs : [[4, 1, 3], [2, 0, 5], [3, 2, 2]])
        .filter((row) => Array.isArray(row))
        .map((row) => [...row]);
    const n = costs.length;
    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty cost matrix - there is no assignment to make.",
            codeLineNumber: 0,
            layout: "matrix",
            meta: { assigned: 0, totalCost: 0, bids: 0 },
        };
        return;
    }
    const m = costs[0]?.length ?? 0;
    if (m < n) {
        yield {
            stepNumber: 0,
            entities: makeCells(costs),
            edges: [],
            description: "Fewer columns than rows - a perfect assignment is impossible.",
            codeLineNumber: 0,
            layout: "matrix",
            meta: { assigned: 0, totalCost: 0, bids: 0 },
        };
        return;
    }

    let maxCost = 0;
    for (const row of costs) {
        for (const value of row) {
            maxCost = Math.max(maxCost, value);
        }
    }
    const scale = n + 1;
    const profit = costs.map((row) => row.map((c) => (maxCost - c) * scale));
    const price = new Array<number>(m).fill(0);
    const owner = new Array<number>(m).fill(-1);
    const free = new Set<number>(Array.from({ length: n }, (_, i) => i));
    let bids = 0;
    let step = 0;

    const assignment = (): Array<[number, number]> => {
        const pairs: Array<[number, number]> = [];
        for (let col = 0; col < n; col += 1) {
            const row = owner[col] ?? -1;
            if (row >= 0) {
                pairs.push([row, col]);
            }
        }
        return pairs;
    };
    const totalCost = (): number =>
        assignment().reduce((sum, [row, col]) => sum + (costs[row]?.[col] ?? 0), 0);

    yield {
        stepNumber: step,
        entities: makeCells(costs),
        edges: [],
        description: `Auction assignment on ${n} by ${n} costs; all rows are free and all prices are zero.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: m, bids, assigned: 0, totalCost: totalCost() },
    };
    step += 1;

    let guard = 0;
    const limit = 20000 * n;
    while (free.size > 0 && guard < limit) {
        guard += 1;
        const bidder = free.values().next().value as number;
        const line = profit[bidder] ?? [];
        let bestCol = -1;
        let bestVal = -Infinity;
        let secondVal = -Infinity;
        for (let col = 0; col < m; col += 1) {
            const value = (line[col] ?? 0) - (price[col] ?? 0);
            if (value > bestVal) {
                secondVal = bestVal;
                bestVal = value;
                bestCol = col;
            } else if (value > secondVal) {
                secondVal = value;
            }
        }
        if (bestCol < 0) {
            break;
        }
        const increment = secondVal === -Infinity ? 1 : Math.max(1, bestVal - secondVal + 1);
        price[bestCol] = (price[bestCol] ?? 0) + increment;
        const displaced = owner[bestCol] ?? -1;
        owner[bestCol] = bidder;
        free.delete(bidder);
        if (displaced >= 0) {
            free.add(displaced);
        }
        bids += 1;

        const states = new Map<string, EntityState>();
        for (const [row, col] of assignment()) {
            states.set(`${row},${col}`, "sorted");
        }
        states.set(`${bidder},${bestCol}`, "comparing");
        yield {
            stepNumber: step,
            entities: makeCells(costs, states),
            edges: [],
            description: `Bidder ${bidder} raises column ${bestCol} by ${increment} to ${price[bestCol]}, taking ownership from ${displaced < 0 ? "nobody" : displaced}.`,
            codeLineNumber: displaced < 0 ? 3 : 4,
            layout: "matrix",
            meta: {
                rows: n,
                cols: m,
                bids,
                assigned: n - free.size,
                totalCost: totalCost(),
                prices: [...price],
            },
        };
        step += 1;
    }

    const states = new Map<string, EntityState>();
    for (const [row, col] of assignment()) {
        states.set(`${row},${col}`, "sorted");
    }
    const complete = free.size === 0;
    yield {
        stepNumber: step,
        entities: makeCells(costs, states),
        edges: [],
        description: complete
            ? `Auction converged after ${bids} bids with assignment cost ${totalCost()}.`
            : `Auction stopped before a full assignment after ${bids} bids.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: m,
            bids,
            assigned: n - free.size,
            totalCost: totalCost(),
            complete,
            prices: [...price],
        },
    };
}

const module: AlgorithmModule = {
    id: "auction-algorithm-assignment",
    name: "Auction Algorithm for Assignment",
    category: "flow",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { costs: [[4, 1, 3], [2, 0, 5], [3, 2, 2]] },
    visualType: "matrix",
    run,
    pseudocode: [
        "initialize every column price to zero and all rows free",
        "scale profits so a unit bid is small enough for optimality",
        "take a free bidder and find its best and second-best column profit",
        "raise the best column price by the profit gap plus one epsilon",
        "give that column to the bidder and free its previous owner",
        "repeat until every bidder owns a column",
        "report the assignment and its total cost",
    ],
    education: {
        intuition:
            "Imagine rows as bidders and columns as objects for sale. Each bidder wants the object with the highest profit minus its price. When several bidders want the same object, its price rises until someone else looks elsewhere, and the displaced bidder tries again.",
        invariants: [
            "Every column price never decreases.",
            "Each column has at most one owner, and each owned row owns exactly one column.",
            "Scaling integer profits by n+1 makes an epsilon bid of one small enough for optimality.",
        ],
        correctness:
            "At termination every bidder owns an object and no bidder can improve by more than epsilon, so the assignment is within n epsilon of optimal. Because profits were scaled by n+1 and epsilon is one, that slack is less than one cost unit; with integral costs the assignment must be optimal.",
        complexityRationale:
            "Each bid raises some price by at least one; total prices are bounded by the scaled profit range, giving O(n^3) bids in the worst case. The profit matrix, prices, and owners use O(n^2) space.",
        uses: [
            "Linear assignment in dense cost matrices",
            "Auction-based task allocation in distributed systems",
            "A teaching model for price-based optimization",
        ],
        references: [
            "D. P. Bertsekas, The Auction Algorithm for Assignment and Other Network Flow Problems, 1990",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, chapter on matching",
        ],
        workedExample:
            "On costs [[4,1,3],[2,0,5],[3,2,2]] with scale four, row one first targets column two. Bids raise column two's price until row one is displaced, then the process settles on row zero to column one, row one to column two, and row two to column zero with total cost 1+5+3 = 9.",
    },
};

export default module;
