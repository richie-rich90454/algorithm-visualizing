/**
 * feedback-arc-set.ts - Feedback Arc Set by Cycle Removal
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A feedback arc set is a collection of directed arcs whose deletion makes a
 * digraph acyclic. This heuristic repeatedly runs a depth-first search, takes
 * the back edge of the first cycle it finds, and deletes that arc. It stops
 * when a topological ordering of the surviving arcs exists. The result is a
 * valid (though not necessarily minimum) feedback arc set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * (V + E)) where k is the number of arcs removed
 *   Space: O(V + E) for adjacency, colors, and the removal list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Surviving arcs are IDLE; the cycle being broken is YELLOW.
 *   - The deleted arc stays RED in later frames.
 *   - The final frame shows the acyclic remainder and its topological order.
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function topoOrder(labels: string[], arcs: Array<[string, string]>): string[] | null {
    const indegree = new Map(labels.map((v) => [v, 0]));
    for (const [, to] of arcs) indegree.set(to, (indegree.get(to) ?? 0) + 1);
    const queue = labels.filter((v) => indegree.get(v) === 0);
    const order: string[] = [];
    while (queue.length > 0) {
        const v = queue.shift() as string;
        order.push(v);
        for (const [from, to] of arcs) {
            if (from !== v) continue;
            const next = (indegree.get(to) ?? 0) - 1;
            indegree.set(to, next);
            if (next === 0) queue.push(to);
        }
    }
    return order.length === labels.length ? order : null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C"],
        B: ["C", "D"],
        C: ["A", "D"],
        D: ["A", "E"],
        E: ["B"],
    };
    const labels = [
        ...new Set([
            ...Object.keys(adjacency),
            ...Object.values(adjacency).flatMap((ns) => ns.map((n) => String(n))),
        ]),
    ].sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty digraph - no feedback arc set is needed.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { removed: 0, acyclic: true, order: [] },
        };
        return;
    }
    const allArcs: Array<[string, string]> = [];
    for (const from of labels) {
        for (const to of adjacency[from] ?? []) {
            if (labels.includes(to) && from !== to) allArcs.push([from, to]);
        }
    }
    const removed = new Set<string>();
    const key = (a: string, b: string): string => `${a}|${b}`;
    const nodes = makeGraphNodes(labels);
    let step = 0;
    let cycle: Array<[string, string]> = [];
    let order = topoOrder(labels, allArcs.filter(([a, b]) => !removed.has(key(a, b)))) ?? [];

    const snap = (description: string, line: number): VisualFrame => {
        const active = new Set(cycle.map(([a, b]) => key(a, b)));
        const edges: VisualEdge[] = allArcs.map(([a, b]) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: removed.has(key(a, b)) ? "error" : active.has(key(a, b)) ? "comparing" : "idle",
            directed: true,
        }));
        for (const node of nodes) node.state = order.length === labels.length ? "sorted" : "unvisited";
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                removed: removed.size,
                acyclic: order.length === labels.length,
                removedArcs: [...removed].map((k) => k.replace("|", ">")).sort(),
                order,
                totalArcs: allArcs.length,
            },
        };
    };

    yield snap(`Loaded ${labels.length} vertices and ${allArcs.length} arcs; looking for cycles.`, 0);
    step += 1;

    for (;;) {
        const current = allArcs.filter(([a, b]) => !removed.has(key(a, b)));
        const result = topoOrder(labels, current);
        if (result !== null) {
            order = result;
            break;
        }
        const color = new Map(labels.map((v) => [v, 0]));
        const stack: Array<[string, string]> = [];
        let backEdge: [string, string] | null = null;
        const dfs = (v: string): boolean => {
            color.set(v, 1);
            for (const [from, to] of current) {
                if (from !== v) continue;
                if (backEdge !== null) return true;
                if (color.get(to) === 1) {
                    backEdge = [from, to];
                    stack.push([from, to]);
                    return true;
                }
                if (color.get(to) === 0) {
                    stack.push([from, to]);
                    if (dfs(to)) return true;
                    stack.pop();
                }
            }
            color.set(v, 2);
            return false;
        };
        for (const v of labels) {
            if (color.get(v) === 0 && dfs(v)) break;
        }
        if (backEdge === null) break;
        const target = backEdge as [string, string];
        cycle = [...stack];
        removed.add(key(target[0], target[1]));
        yield snap(`Cycle found; delete arc ${target[0]}->${target[1]} to break it.`, 3);
        step += 1;
        cycle = [];
    }

    yield snap(
        order.length === labels.length
            ? `Graph is acyclic after removing ${removed.size} arc(s); topological order ${order.join(", ")}.`
            : `Stopped with ${removed.size} arc(s) removed; no topological order was found.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A directed cycle cannot be topologically sorted. Find one cycle by depth-first search, cut one of its arcs, and repeat. Every deletion removes at least one cycle, so eventually the remaining arcs admit a topological order and the collected deletions form a feedback arc set.",
        invariants: [
            "Only arcs that belong to a discovered back edge are removed.",
            "The number of surviving arcs decreases by one per iteration.",
            "The removed set grows monotonically until the graph is acyclic.",
        ],
        correctness:
            "A back edge in depth-first search joins a vertex to an ancestor still on the recursion stack, so the tree path plus that edge is a directed cycle. Removing the back edge destroys that cycle, and each iteration strictly reduces the arc count, so the loop terminates. The loop exits only when topological sorting succeeds, which happens exactly when no directed cycle remains; therefore the removed arcs hit every cycle and form a feedback arc set.",
        complexityRationale:
            "Each iteration runs a depth-first search and a topological sort, both O(V + E), and may remove one arc, so total time is O(k(V + E)) for k deletions at most E. Storing colors, the stack, and the removed set uses O(V + E) space.",
        uses: [
            "Breaking circular dependencies before topological scheduling",
            "Making a control-flow graph acyclic for compiler analysis",
            "Converting cyclic precedence constraints into a DAG approximation",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, depth-first search and topological sort",
            "Bang-Jensen and Gutin, Digraphs: Theory, Algorithms and Applications, feedback arc sets",
        ],
        workedExample:
            "For arcs A->B, B->C, C->A plus C->D, depth-first search finds the back edge C->A. Removing it leaves A->B, B->C, C->D, which topologically sorts as A, B, C, D, so the single arc C->A is a feedback arc set.",
    },
    id: "feedback-arc-set",
    name: "Feedback Arc Set (Cycle Removal)",
    category: "graph",
    complexity: { time: "O(k * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["C", "D"],
            C: ["A", "D"],
            D: ["A", "E"],
            E: ["B"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with all directed arcs present",
        "attempt a topological ordering of the current arcs",
        "if one exists, stop because the graph is acyclic",
        "otherwise run depth-first search to find a back edge",
        "delete that back edge from the arc set",
        "record the deletion and repeat the search",
        "report the removed arcs and the final ordering",
    ],
};

export default module;
