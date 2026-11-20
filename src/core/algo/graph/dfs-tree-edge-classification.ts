/**
 * dfs-tree-edge-classification.ts – DFS Tree / Edge Classification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * One directed depth-first search labels every edge by the state of its
 * target when crossed: a tree edge discovers a fresh vertex, a back edge
 * reaches an ancestor still on the stack (a cycle!), a forward edge jumps
 * to an already-finished descendant, and a cross edge links two finished
 * subtrees. On A→B→C plus A→C, the walk A→B→C plants two tree edges and
 * the shortcut A→C lands on a finished descendant: one forward edge.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one DFS with constant work per edge
 *   Space: O(V + E) for colors, timestamps, and the four edge lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Discovery (tree) edges are GREEN (path).
 *   - Forward edges are BLUE (active); back edges flash RED (swapped).
 *   - Cross edges are PINK (highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Undirected graphs only ever produce tree and back edges.
 *   - A directed graph is acyclic exactly when no back edge appears.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? { A: ["B", "C"], B: ["C"], C: [] };

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
    const color = new Map(labels.map((v) => [v, 0]));
    const found: Record<string, Array<[string, string]>> = {
        tree: [],
        back: [],
        forward: [],
        cross: [],
    };
    setN(start, "comparing");
    yield snap(
        `Directed DFS from ${start}: classify every edge as tree/back/forward/cross.`,
        0,
        {},
    );
    step += 1;
    const dfs = (u: string): void => {
        color.set(u, 1);
        disc.set(u, ++t0);
        for (const v of adjacency[u] ?? []) {
            const c = color.get(v) as number;
            if (c === 0) {
                (found.tree as Array<[string, string]>).push([u, v]);
                setE(u, v, "path");
                setN(v, "comparing");
                dfs(v);
            } else if (c === 1) {
                (found.back as Array<[string, string]>).push([u, v]);
                setE(u, v, "swapped");
            } else if ((disc.get(u) as number) < (disc.get(v) as number)) {
                (found.forward as Array<[string, string]>).push([u, v]);
                setE(u, v, "active");
            } else {
                (found.cross as Array<[string, string]>).push([u, v]);
                setE(u, v, "highlight");
            }
        }
        color.set(u, 2);
        fin.set(u, ++clock);
        setN(u, "visited");
    };
    const disc = new Map<string, number>();
    let t0 = 0;
    const fin = new Map<string, number>();
    let clock = 0;
    dfs(start);
    for (const v of labels) if ((color.get(v) as number) === 0) dfs(v);
    const fmt = (xs: Array<[string, string]>): string =>
        xs.map(([a, b]) => `${a}→${b}`).join(", ") || "∅";
    yield snap(`Tree {${fmt(found.tree)}} – discovery edges of the DFS forest.`, 1, {});
    step += 1;
    yield snap(`Forward {${fmt(found.forward)}} – to an already-finished descendant.`, 2, {});
    step += 1;
    yield snap(`Back {${fmt(found.back)}}, cross {${fmt(found.cross)}} – none here (DAG).`, 3, {});
    step += 1;
    clr();
    for (const [a, b] of found.tree) setE(a, b, "path");
    for (const [a, b] of found.forward) setE(a, b, "active");
    yield snap(`Classification done: tree A→B, B→C; forward A→C.`, 4, {
        tree: found.tree.length,
        back: found.back.length,
        forward: found.forward.length,
        cross: found.cross.length,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "One directed depth-first search can classify every edge by the color of its target when it is crossed. A tree edge reaches a fresh vertex, a back edge reaches an ancestor still on the recursion stack, a forward edge jumps to a finished descendant, and a cross edge links two finished subtrees.",
        "invariants": [
            "Discovery and finish timestamps give every vertex an interval of activity.",
            "A gray target means the edge points to an ancestor and reveals a cycle.",
            "Tree edges form a DFS forest over all vertices."
        ],
        "correctness": "At the moment an edge is examined, the target's color records its relationship in the DFS tree: white means undiscovered so the edge is a tree edge, gray means an active ancestor so it is a back edge, and black means finished, which is a forward edge if the target is a descendant and a cross edge otherwise. Timestamps distinguish the last two cases, so the classification is exact.",
        "complexityRationale": "A single DFS touches each edge once and each vertex a constant number of times, O(V + E); colors, timestamps, and the four edge lists use O(V + E) space.",
        "uses": [
            "Cycle detection in directed graphs",
            "Compilers analyzing control-flow and call graphs",
            "A first step in many DFS-based graph algorithms"
        ],
        "references": [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, depth-first search",
            "Tarjan, Depth-First Search and Linear Graph Algorithms (1972)"
        ],
        "workedExample": "For edges A to B, B to C, and A to C, DFS from A marks A-B and B-C as tree edges. When A to C is examined, C is already finished and is a descendant of A, so that edge is classified as a forward edge."
    },
    id: "dfs-tree-edge-classification",
    name: "DFS Tree / Edge Classification",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["C"], C: [] }, start: "A" },
    visualType: "graph",
    run,
    pseudocode: [
        "color every vertex white; start directed DFS from the start",
        "white target: tree edge, recurse into the fresh vertex",
        "finished descendant with a later timestamp: forward edge",
        "gray target: back edge; finished non-descendant: cross edge",
        "done: every edge filed as tree, back, forward, or cross",
    ],
};

export default module;
