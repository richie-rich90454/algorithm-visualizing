/**
 * windy-postman-problem.ts - Windy Postman Problem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The windy postman must traverse every edge of an undirected graph at least
 * once and return to the starting vertex, but crossing an edge costs one
 * amount in one direction and a different amount in the other. This module
 * solves small instances exactly with Dijkstra over an expanded state: the
 * current vertex plus a base-4 digit per edge recording which directions have
 * already been used (none, forward, backward, or both). Traversing the same
 * direction twice is never useful, so four states per edge suffice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n * 4^m * m) for n vertices and m edges in the worst case
 *   Space: O(n * 4^m) for the expanded Dijkstra table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Used-once edges are BLUE (path), edges used in both directions are
 *     YELLOW (comparing), and unused edges are idle.
 *   - The caption reports the cheapest closed tour found so far.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    edges?: Array<[string, string, number, number]>;
    start?: string;
}

interface Item {
    cost: number;
    node: number;
    mask: number;
}

/** Dijkstra over (vertex, per-edge usage digits). */
function solve(
    n: number,
    edges: Array<{ a: number; b: number; forward: number; backward: number }>,
    start: number,
    targetMask: number,
): { cost: number; mask: number } {
    const size = n * targetMask;
    const dist = new Array<number>(size).fill(Infinity);
    const startKey = start * targetMask;
    dist[startKey] = 0;
    // A simple binary heap keyed by cost.
    const heap: Item[] = [{ cost: 0, node: start, mask: 0 }];
    const push = (item: Item): void => {
        heap.push(item);
        let i = heap.length - 1;
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if ((heap[parent] as Item).cost <= (heap[i] as Item).cost) break;
            const tmp = heap[parent] as Item;
            heap[parent] = heap[i] as Item;
            heap[i] = tmp;
            i = parent;
        }
    };
    const pop = (): Item | undefined => {
        if (heap.length === 0) return undefined;
        const top = heap[0] as Item;
        const last = heap.pop() as Item;
        if (heap.length > 0) {
            heap[0] = last;
            let i = 0;
            while (true) {
                const l = 2 * i + 1;
                const r = 2 * i + 2;
                let smallest = i;
                if (l < heap.length && (heap[l] as Item).cost < (heap[smallest] as Item).cost) smallest = l;
                if (r < heap.length && (heap[r] as Item).cost < (heap[smallest] as Item).cost) smallest = r;
                if (smallest === i) break;
                const tmp = heap[smallest] as Item;
                heap[smallest] = heap[i] as Item;
                heap[i] = tmp;
                i = smallest;
            }
        }
        return top;
    };

    while (heap.length > 0) {
        const item = pop() as Item;
        const key = item.node * targetMask + item.mask;
        if (item.cost !== dist[key]) continue;
        let covered = true;
        for (let e = 0; e < edges.length; e += 1) {
            if (Math.floor(item.mask / (4 ** e)) % 4 === 0) { covered = false; break; }
        }
        if (item.node === start && covered) {
            return { cost: item.cost, mask: item.mask };
        }
        for (let e = 0; e < edges.length; e += 1) {
            const edge = edges[e] as { a: number; b: number; forward: number; backward: number };
            const digit = Math.floor(item.mask / (4 ** e)) % 4;
            let nextDigit = -1;
            let nextNode = -1;
            let extra = 0;
            if (digit === 0) {
                if (item.node === edge.a) { nextDigit = 1; nextNode = edge.b; extra = edge.forward; }
                else if (item.node === edge.b) { nextDigit = 2; nextNode = edge.a; extra = edge.backward; }
            } else if (digit === 1 && item.node === edge.b) {
                nextDigit = 3; nextNode = edge.a; extra = edge.backward;
            } else if (digit === 2 && item.node === edge.a) {
                nextDigit = 3; nextNode = edge.b; extra = edge.forward;
            }
            if (nextDigit < 0) continue;
            const nextMask = item.mask + (nextDigit - digit) * (4 ** e);
            const nextCost = item.cost + extra;
            const nextKey = nextNode * targetMask + nextMask;
            if (nextCost < (dist[nextKey] as number)) {
                dist[nextKey] = nextCost;
                push({ cost: nextCost, node: nextNode, mask: nextMask });
            }
        }
    }
    return { cost: -1, mask: -1 };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B", 3, 1], ["A", "C", 1, 4], ["B", "C", 2, 2], ["C", "D", 5, 1],
        ] as Array<[string, string, number, number]>);
    const clean = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b, f, g]) => [a, b, typeof f === "number" && f > 0 ? f : 1, typeof g === "number" && g > 0 ? g : 1] as [string, string, number, number])
        .slice(0, 7);
    const vertices = [...new Set(clean.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const edges = clean.map(([a, b, forward, backward]) => ({
        a: index.get(a) as number,
        b: index.get(b) as number,
        forward,
        backward,
    }));
    const startLabel = typeof task.start === "string" && index.has(task.start) ? task.start : vertices[0] ?? "A";
    const start = index.get(startLabel) as number;
    const targetMask = 4 ** edges.length;

    const makeFrame = (description: string, codeLine: number, phase: string, code: number[]): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (i === start ? "path" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, start: i === start },
        }));
        const visualEdges: VisualEdge[] = clean.map(([a, b, forward, backward], i) => {
            const digit = code[i] ?? 0;
            let state: EntityState = "idle";
            if (digit === 3) state = "comparing";
            else if (digit === 1 || digit === 2) state = "path";
            return {
                id: `edge-${a}-${b}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: `${forward}/${backward}`,
                state,
                directed: false,
            };
        });
        return {
            stepNumber: 0,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                labels: vertices,
                usage: code.join(""),
                edgeCount: edges.length,
                optimalCost: -1,
            },
        };
    };

    const initial = makeFrame(`Windy postman on ${edges.length} edges from ${startLabel}; costs are forward/backward.`, 0, "setup", new Array<number>(edges.length).fill(0));
    initial.stepNumber = 0;
    yield initial;

    const result = solve(n, edges, start, targetMask);
    const digits: number[] = [];
    let mask = result.mask < 0 ? targetMask - 1 : result.mask;
    for (let e = 0; e < edges.length; e += 1) {
        digits.push(Math.floor(mask / (4 ** e)) % 4);
    }
    const middle = makeFrame(
        result.cost < 0
            ? "No closed traversal exists for this instance."
            : `Expanded Dijkstra found a closed tour of cost ${result.cost}.`,
        4,
        result.cost < 0 ? "none" : "search",
        digits,
    );
    middle.stepNumber = 1;
    middle.meta["optimalCost"] = result.cost;
    yield middle;

    const final = makeFrame(
        result.cost < 0
            ? "Windy postman has no feasible closed tour."
            : `Optimal windy postman tour costs ${result.cost}; every edge is covered.`,
        7,
        "done",
        digits,
    );
    final.stepNumber = 2;
    final.meta["optimalCost"] = result.cost;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A postman walks every street and returns home, but on a windy day a hill costs more uphill than downhill. Since repeating a street in the same direction never helps, each edge needs to be used at most once per direction. That gives four possible states per edge, so a shortest-path search over the current corner and the usage pattern of all streets finds the cheapest complete tour exactly on small instances.",
        invariants: [
            "An edge digit records whether the edge has been used forward, backward, both, or neither.",
            "A direction once used is never used again, so no optimal tour is excluded.",
            "A state is a valid partial tour from the start to its current vertex.",
        ],
        correctness:
            "Any closed walk covering every edge induces a usage digit per edge among the four permitted values, because a second traversal in an already-used direction can be removed without disconnecting the walk. Dijkstra explores exactly these expanded states and keeps the cheapest path to each. The goal state requires the start vertex and every digit nonzero, which is precisely a closed traversal covering all edges, so the first goal state popped has minimum cost.",
        complexityRationale:
            "There are n vertices and 4^m usage masks, and each state relaxes m edges, so the expanded graph has O(n * 4^m * m) work with a logarithmic heap factor. The distance table stores O(n * 4^m) entries.",
        uses: [
            "Mail delivery and street-sweeping with direction-dependent costs",
            "Inspection routes where travel time depends on direction",
            "Robotic coverage tasks on weighted graphs",
        ],
        references: [
            "Guan, Guan, and Liu, The Windy Postman Problem, European Journal of Operational Research, 1989",
            "CLRS, Introduction to Algorithms, Chapter 22 on shortest paths",
        ],
        workedExample:
            "On a single edge A-B costing 3 from A to B and 1 from B to A, the postman starts at A, crosses to B for 3, returns for 1, and ends at A with total cost 4. The usage digit for the edge becomes both-directions in the optimal state.",
    },
    id: "windy-postman-problem",
    name: "Windy Postman Problem",
    category: "graph",
    complexity: { time: "O(n * 4^m * m)", space: "O(n * 4^m)" },
    defaultInput: { edges: [["A", "B", 3, 1], ["A", "C", 1, 4], ["B", "C", 2, 2], ["C", "D", 5, 1]], start: "A" },
    visualType: "graph",
    run,
    pseudocode: [
        "assign each edge a base-4 usage digit",
        "start Dijkstra at the start vertex with all digits zero",
        "for each state relax every edge by its direction cost",
        "allow forward then backward, or backward then forward",
        "skip a direction already used for that edge",
        "stop at the start with all digits nonzero",
        "read off the cheapest closed tour and its cost",
        "done: report the optimal windy postman tour",
    ],
};

export default module;
