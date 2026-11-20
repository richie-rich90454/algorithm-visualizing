/**
 * branch-and-bound-tsp.ts - Exact Traveling Salesman Tour by Branch and Bound
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This solver enumerates permutations of cities in a depth-first search but
 * prunes a partial tour as soon as a lower bound proves it cannot beat the
 * best complete tour found so far. The bound is the cost of a minimum spanning
 * tree over the current and unvisited cities plus the cheapest return edge to
 * the start: any completion is a spanning path, so it costs at least that much.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n! 2^n) worst case; the MST bound prunes most branches in practice
 *   Space: O(n) for the recursion, distance matrix, and best tour
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cities are points at their given coordinates.
 *   - The current partial tour is drawn as active edges.
 *   - The best complete tour is green and reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const raw = Array.isArray(task.points) ? task.points : [];
    const points: Point[] = raw
        .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => [Number(p[0]), Number(p[1])] as Point);
    const n = points.length;

    const distance: number[][] = points.map((p, i) =>
        points.map((q, j) =>
            i === j ? 0 : Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0)),
        ),
    );

    const makeEdges = (order: number[], state: "active" | "sorted" | "idle"): VisualEdge[] => {
        const edges: VisualEdge[] = [];
        for (let i = 0; i + 1 < order.length; i += 1) {
            const a = order[i];
            const b = order[i + 1];
            if (a === undefined || b === undefined) {
                continue;
            }
            edges.push({
                id: `tour-${a}-${b}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: (distance[a]?.[b] ?? 0).toFixed(2),
                state,
                directed: false,
            });
        }
        return edges;
    };

    const makeNodes = (order: number[], current: number): VisualEntity[] =>
        points.map((point, index) => ({
            id: `node-${index}`,
            type: "node" as const,
            label: String(index),
            value: { x: point[0], y: point[1] },
            state: index === current ? "active" : order.includes(index) ? "path" : "unvisited",
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            width: 0,
            height: 0,
            metadata: { index, x: point[0] ?? 0, y: point[1] ?? 0 },
        }));

    const snap = (
        message: string,
        line: number,
        order: number[],
        current: number,
        bestOrder: number[],
        best: number,
        explored: number,
        pruned: number,
    ): VisualFrame => ({
        stepNumber: 0,
        entities: makeNodes(order, current),
        edges: makeEdges(bestOrder.length > 1 ? bestOrder : order, bestOrder.length > 1 ? "sorted" : "active"),
        description: message,
        codeLineNumber: line,
        layout: "point",
        meta: {
            cities: n,
            explored,
            pruned,
            bestLength: Number.isFinite(best) ? best : 0,
            bestTour: bestOrder.map((index) => index),
            currentLength: order.length > 1 ? order.reduce((sum, index, i) => {
                const next = order[i + 1];
                return next === undefined ? sum : sum + (distance[index]?.[next] ?? 0);
            }, 0) : 0,
        },
    });

    if (n < 3) {
        const trivial = n === 2 ? (distance[0]?.[1] ?? 0) * 2 : 0;
        yield {
            ...snap(
                n < 2 ? "Fewer than two cities: the tour has zero length." : "Two cities: the tour goes out and back.",
                0,
                points.map((_p, i) => i),
                0,
                points.map((_p, i) => i),
                trivial,
                0,
                0,
            ),
            stepNumber: 0,
        };
        return;
    }

    let best = Infinity;
    let bestOrder: number[] = [];
    let explored = 0;
    let pruned = 0;

    /** Lower bound: MST on current plus unvisited cities, plus cheapest return. */
    const lowerBound = (current: number, unvisited: number[]): number => {
        if (unvisited.length === 0) {
            return distance[current]?.[0] ?? 0;
        }
        const nodes = [current, ...unvisited];
        const inTree = new Set<number>([current]);
        let cost = 0;
        while (inTree.size < nodes.length) {
            let pick = -1;
            let pickCost = Infinity;
            for (const from of inTree) {
                for (const to of nodes) {
                    if (inTree.has(to)) {
                        continue;
                    }
                    const w = distance[from]?.[to] ?? Infinity;
                    if (w < pickCost) {
                        pickCost = w;
                        pick = to;
                    }
                }
            }
            if (pick < 0) {
                break;
            }
            cost += pickCost;
            inTree.add(pick);
        }
        let returnCost = Infinity;
        for (const u of unvisited) {
            returnCost = Math.min(returnCost, distance[u]?.[0] ?? Infinity);
        }
        return cost + returnCost;
    };

    const search = (current: number, visited: Set<number>, cost: number, order: number[]): void => {
        explored += 1;
        if (cost >= best) {
            pruned += 1;
            return;
        }
        const unvisited = points.map((_p, i) => i).filter((i) => !visited.has(i));
        if (unvisited.length === 0) {
            const total = cost + (distance[current]?.[0] ?? 0);
            if (total < best) {
                best = total;
                bestOrder = [...order];
            }
            return;
        }
        if (lowerBound(current, unvisited) >= best) {
            pruned += 1;
            return;
        }
        const nexts = unvisited.sort((a, b) => (distance[current]?.[a] ?? 0) - (distance[current]?.[b] ?? 0));
        for (const next of nexts) {
            visited.add(next);
            search(next, visited, cost + (distance[current]?.[next] ?? 0), [...order, next]);
            visited.delete(next);
        }
    };

    let step = 0;
    yield {
        ...snap(
            `Branch and bound on ${n} cities with an MST lower bound.`,
            1,
            [0],
            0,
            [],
            Infinity,
            0,
            0,
        ),
        stepNumber: step,
    };
    step += 1;

    let lastReported = Infinity;
    search(0, new Set<number>([0]), 0, [0]);
    if (Number.isFinite(best)) {
        yield {
            ...snap(
                `Improved the best tour to length ${best.toFixed(2)} after ${explored} branch nodes.`,
                5,
                [0],
                0,
                bestOrder,
                best,
                explored,
                pruned,
            ),
            stepNumber: step,
        };
        step += 1;
        lastReported = best;
    }

    const closed = [...bestOrder, 0];
    yield {
        ...snap(
            `Optimal tour ${closed.join(" -> ")} has length ${best.toFixed(2)}; ${pruned} branch(es) pruned.`,
            7,
            bestOrder,
            0,
            bestOrder,
            lastReported,
            explored,
            pruned,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Listing every tour is correct but wasteful. Branch and bound explores tours as a tree of choices and, at each partial tour, computes a cheap optimistic estimate of how good any completion could be. If even that optimistic value is worse than a tour already found, the whole branch is thrown away without enumerating it.",
        invariants: [
            "The best complete tour seen so far always has length at least the true optimum.",
            "The MST bound never exceeds the cost of any valid completion.",
            "A city is appended to the partial tour exactly once.",
        ],
        correctness:
            "Any completion of a partial tour is a spanning path from the current city through all unvisited cities and back to the start. Removing the return edge leaves a spanning tree, whose weight is at least the minimum spanning tree of those vertices; the return edge is at least the cheapest edge from an unvisited city to the start. The bound is therefore admissible, and pruning a branch with an admissible bound cannot discard the optimum. Exhausting the remaining branches leaves a globally minimal tour.",
        complexityRationale:
            "In the worst case all n! permutations are examined, and each bound computation builds an MST in O(n^2), giving the stated factorial-time bound. The recursion, distance matrix, and stored tour use O(n) space.",
        uses: [
            "Planning short delivery and inspection routes",
            "Circuit-board drilling and machine-tool path ordering",
            "A teaching example for admissible bounds and pruning",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on NP-completeness",
            "Lawler, Lenstra, Rinnooy Kan and Shmoys, The Traveling Salesman Problem",
        ],
        workedExample:
            "For four cities at the corners of a unit square, the first complete tour found has length 4. With the current corner and two unvisited corners, the MST bound plus the cheapest return is also 4, so any sibling branch that cannot reach below 4 is pruned and the square tour is confirmed optimal.",
    },
    id: "branch-and-bound-tsp",
    name: "Branch and Bound TSP",
    category: "graph",
    complexity: { time: "O(n! * 2^n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [3, 0],
            [4, 2],
            [1, 3],
            [-1, 1],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "precompute all pairwise city distances",
        "start at city zero and set the best length to infinity",
        "compute an MST lower bound for the unvisited cities",
        "prune the branch when the bound is not better than the best",
        "for each nearby unvisited city, extend the partial tour",
        "on reaching all cities, close the tour and update the best",
        "repeat depth first until every branch is explored or pruned",
        "report the optimal tour and its length",
    ],
};

export default module;
