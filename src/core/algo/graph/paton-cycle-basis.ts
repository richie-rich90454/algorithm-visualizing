/**
 * paton-cycle-basis.ts - Paton Cycle Basis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A cycle basis is a smallest set of cycles from which every other cycle can
 * be built by combining them. Paton's algorithm grows a spanning tree of the
 * graph, then walks each remaining edge: the tree path between that edge's
 * endpoints plus the edge itself is a fundamental cycle. These cycles are
 * independent by construction and their number is m minus n plus one per
 * connected component, which is the dimension of the cycle space.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V*(V+E)) for the tree-path walks in this simple version
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree edges turn green as the spanning tree grows.
 *   - For each non-tree edge, its tree path and closing edge light up red.
 *   - Final frame states the basis size and the list of cycles.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

type Edge = [string, string];
const key = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C"],
    };

    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const neighbor = new Map<string, Set<string>>(labels.map((v) => [v, new Set<string>()]));
    const edgeSet = new Set<string>();
    const edges: Edge[] = [];
    for (const [u, list] of Object.entries(graph)) {
        if (!neighbor.has(u)) continue;
        for (const v of list) {
            if (v === u || !neighbor.has(v)) continue;
            neighbor.get(u)!.add(v);
            neighbor.get(v)!.add(u);
            const k = key(u, v);
            if (!edgeSet.has(k)) {
                edgeSet.add(k);
                edges.push([u, v]);
            }
        }
    }

    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const visualEdges = makeGraphEdges(graph);
    let step = 0;

    const reset = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of visualEdges) e.state = "idle";
    };
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: visualEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta: {
            vertices: labels.length,
            edges: edges.length,
            cycleCount: 0,
            ...meta,
        },
    });

    yield snap("Graph loaded; build a spanning forest first.", 0, {});
    step += 1;

    // Spanning forest via DFS, recording parent and depth.
    const parent = new Map<string, string>();
    const depth = new Map<string, number>();
    const treeEdges = new Set<string>();
    for (const root of labels) {
        if (depth.has(root)) continue;
        depth.set(root, 0);
        const stack = [root];
        while (stack.length > 0) {
            const v = stack.pop() as string;
            for (const u of neighbor.get(v)!) {
                if (depth.has(u)) continue;
                depth.set(u, (depth.get(v) as number) + 1);
                parent.set(u, v);
                treeEdges.add(key(v, u));
                stack.push(u);
                reset();
                for (const node of nodes) if (depth.has(String(node.value))) node.state = "visited";
                for (const e of visualEdges) {
                    if (treeEdges.has(key(String(e.sourceId).replace("node-", ""), String(e.targetId).replace("node-", "")))) e.state = "path";
                }
                yield snap(`Tree edge ${v}-${u} added to the spanning forest.`, 2, { treeEdges: treeEdges.size });
                step += 1;
            }
        }
    }

    // Tree path between two vertices using depths and parent pointers.
    const treePath = (a: string, b: string): string[] => {
        const up: string[] = [];
        const down: string[] = [];
        let x = a;
        let y = b;
        while ((depth.get(x) as number) > (depth.get(y) as number)) {
            up.push(x);
            x = parent.get(x) as string;
        }
        while ((depth.get(y) as number) > (depth.get(x) as number)) {
            down.push(y);
            y = parent.get(y) as string;
        }
        while (x !== y) {
            up.push(x);
            down.push(y);
            x = parent.get(x) as string;
            y = parent.get(y) as string;
        }
        up.push(x);
        return [...up, ...down.reverse()];
    };

    const cycles: string[][] = [];
    for (const [a, b] of edges) {
        if (treeEdges.has(key(a, b))) continue;
        const path = treePath(a, b);
        const cycle = [...path, a];
        cycles.push(cycle);

        reset();
        for (const node of nodes) if (cycle.includes(String(node.value))) node.state = "active";
        for (const e of visualEdges) {
            const s = String(e.sourceId).replace("node-", "");
            const t = String(e.targetId).replace("node-", "");
            for (let i = 0; i < cycle.length - 1; i += 1) {
                if (key(cycle[i] as string, cycle[i + 1] as string) === key(s, t)) e.state = "path";
            }
        }
        yield snap(
            `Non-tree edge ${a}-${b} closes fundamental cycle ${cycle.join("-")}.`,
            4,
            { cycleCount: cycles.length, cycles: cycles.map((c) => c.join("-")), current: cycle.join("-") },
        );
        step += 1;
    }

    reset();
    for (const node of nodes) node.state = "sorted";
    const components = (() => {
        const seen = new Set<string>();
        let count = 0;
        for (const v of labels) {
            if (seen.has(v)) continue;
            count += 1;
            const stack = [v];
            seen.add(v);
            while (stack.length) {
                const x = stack.pop() as string;
                for (const u of neighbor.get(x)!) if (!seen.has(u)) {
                    seen.add(u);
                    stack.push(u);
                }
            }
        }
        return count;
    })();
    const expected = edges.length - labels.length + components;
    yield snap(
        `Done: ${cycles.length} independent cycles form a basis of dimension ${expected}.`,
        6,
        { cycleCount: cycles.length, cycles: cycles.map((c) => c.join("-")), expected, components },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick any spanning tree of the graph. Every edge that is not in the tree joins two vertices already connected by a unique tree path, so adding that edge closes a loop. Collect one such fundamental cycle per non-tree edge. Because each cycle contains a different non-tree edge, no one of them can be built from the others, and together they span every cycle in the graph. That makes them a cycle basis.",
        invariants: [
            "The spanning forest connects each component without creating a cycle.",
            "The tree path between the endpoints of a non-tree edge is unique.",
            "Each fundamental cycle contains exactly one non-tree edge, so the cycles are independent.",
        ],
        correctness:
            "A spanning forest has n minus c edges, leaving m minus n plus c non-tree edges, which equals the dimension of the cycle space. For each non-tree edge the unique tree path between its endpoints plus that edge is a genuine cycle. Independence follows because every fundamental cycle has a private non-tree edge that appears in no other fundamental cycle, so no nonempty symmetric difference of them is empty. Since their count equals the cycle space dimension, they form a basis, and any cycle can be expressed as their sum over the field with two elements.",
        complexityRationale:
            "Building the forest costs O(V+E). Each non-tree edge walks parent pointers up to the depth of its endpoints, O(V) per edge, giving O(V*(V+E)) in this direct implementation. Storing the forest, depths, and cycles uses O(V+E) space.",
        uses: [
            "Electrical circuit analysis via independent loop currents",
            "Structural engineering and constraint solving",
            "A first constructive example of a vector space over GF(2)",
        ],
        references: [
            "Paton, An Algorithm for Finding a Fundamental Set of Cycles of a Graph, 1969",
            "Diestel, Graph Theory, Chapter 1 on cycles and spanning trees",
        ],
        workedExample:
            "Take a square A-B-C-D-A with a diagonal A-C. A spanning tree uses A-B, B-C, C-D. The non-tree edges are D-A and A-C, giving cycles A-B-C-D-A and A-B-C-A. There are m minus n plus one equals five minus four plus one equals two independent cycles, matching the basis size.",
    },
    id: "paton-cycle-basis",
    name: "Paton Cycle Basis",
    category: "graph",
    complexity: { time: "O(V·(V+E))", space: "O(V+E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "deduplicate the undirected edges of the graph",
        "grow a spanning forest with depth-first search",
        "record the parent and depth of every vertex",
        "for each edge not in the forest",
        "walk parent pointers from each endpoint to find the tree path",
        "close the path with the non-tree edge to form a cycle",
        "collect the fundamental cycles as a basis",
        "done: report the basis and its dimension",
    ],
};

export default module;
