/**
 * ear-decomposition.ts – Ear Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ear decomposition builds a graph path by path: start with one cycle
 * (or a single vertex), then repeatedly attach an "ear" – a path whose two
 * endpoints already belong to the built part while its inner vertices are
 * new. Here a depth-first search grows the spine (tree edges form the first
 * long ear), and every non-tree edge starts a new ear. On the cycle
 * A–B–C–D–A the spine A→B→C→D plus the closing edge D–A rebuilds the ring.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one DFS plus one scan of non-tree edges
 *   Space: O(V + E) for the tree set and ear lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - DFS tree edges under construction are BLUE (active), then GREEN.
 *   - Each new ear flashes GREEN (path) with PINK (highlight) endpoints.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A graph has an ear decomposition exactly when it is 2-edge-connected.
 *   - Ears certify robustness: no single edge removal disconnects the part.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "A"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const seen = new Set<string>([start]);
    const tree = new Set<string>();
    const discOrder = [start];
    const tkey = (a: string, b: string): string => [a, b].sort().join("|");
    const stack = [start];
    setN(start, "comparing");
    yield snap(`DFS tree from ${start}: tree edges form the first long ear.`, 0, {});
    step += 1;
    while (stack.length > 0) {
        const u = stack.pop() as string;
        for (const v of adjacency[u] ?? []) {
            if (!seen.has(v)) {
                seen.add(v);
                discOrder.push(v);
                tree.add(tkey(u, v));
                stack.push(v);
                setE(u, v, "active");
                setE(v, u, "active");
                setN(v, "comparing");
            }
        }
    }
    yield snap(
        `DFS discovery order ${discOrder.join("→")}: tree edges form the first long ear.`,
        1,
        {},
    );
    step += 1;
    yield snap(`DFS tree edges: ${[...tree].join(" ")} – every other edge starts an ear.`, 1, {});
    step += 1;
    const ears: string[][] = [];
    const ekey = new Set<string>();
    for (const [u, vs] of Object.entries(adjacency))
        for (const v of vs) {
            const k = tkey(u, v);
            if (!tree.has(k) && !ekey.has(k)) {
                ekey.add(k);
                ears.push([u, v]);
            }
        }
    clr();
    for (const k of tree) {
        const [a, b] = k.split("|") as [string, string];
        setE(a, b, "sorted");
        setE(b, a, "sorted");
    }
    let i = 0;
    for (const [a, b] of ears) {
        i += 1;
        setE(a, b, "path");
        setE(b, a, "path");
        setN(a, "highlight");
        setN(b, "highlight");
        yield snap(`Ear P${i}: ${a}–${b} attaches its endpoints to the built part.`, 2, { ear: i });
        step += 1;
        if (step > 12) break;
    }
    yield snap(`Ear decomposition: spine + ${ears.length} ear(s) rebuild the whole graph.`, 4, {
        ears: ears.length,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An ear decomposition builds a graph path by path. Start with a cycle or single vertex, then repeatedly attach an ear, which is a path whose endpoints are already in the constructed part while its inner vertices are new. Every 2-connected graph has such a decomposition, and this demo derives one from a DFS tree and its non-tree edges.",
        "invariants": [
            "The constructed subgraph starts with the DFS spine and stays connected.",
            "Each added ear has both endpoints in the existing subgraph and new internal vertices.",
            "Every edge of the graph eventually belongs to the spine or to exactly one ear."
        ],
        "correctness": "DFS tree edges form an initial path-like spine, and every non-tree edge closes a cycle whose endpoints already lie in the spine, qualifying as an ear. Because all edges are either tree edges or non-tree edges, the process covers every edge, producing a valid ear decomposition.",
        "complexityRationale": "One DFS plus a scan of non-tree edges costs O(V + E), with O(V + E) space for the tree set and ear lists.",
        "uses": [
            "Characterizing 2-connected graphs",
            "Testing biconnectivity constructively",
            "A tool in graph structure theory and some matching algorithms"
        ],
        "references": [
            "Whitney, Congruent Graphs and the Connectivity of Graphs (1932)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, depth-first search"
        ],
        "workedExample": "On the cycle A-B-C-D-A, DFS builds the spine A-B-C-D. The closing non-tree edge D-A becomes the final ear; its endpoints are already in the spine and it has no new internal vertices, so spine plus ear reconstructs the whole ring."
    },
    id: "ear-decomposition",
    name: "Ear Decomposition",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "grow a DFS tree from the start vertex",
        "tree edges form the first long ear",
        "for each non-tree edge: attach it as a new ear by its endpoints",
        "repeat until every edge belongs to the spine or an ear",
        "done: spine plus ears rebuild the whole graph",
    ],
};

export default module;
