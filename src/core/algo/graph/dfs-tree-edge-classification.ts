/**
 * dfs-tree-edge-classification.ts – DFS Tree / Edge Classification
 *
 * Directed DFS labels each edge: tree (discovery), back (to ancestor),
 * forward (to finished descendant), cross (across subtrees). A→B→C plus
 * A→C: two tree edges, one forward edge.
 * Time: O(V + E) Space: O(V + E)
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
    yield snap(`Classification done: tree A→B, B→C; forward A→C.`, 4, {});
}

const module: AlgorithmModule = {
    id: "dfs-tree-edge-classification",
    name: "DFS Tree / Edge Classification",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["C"], C: [] }, start: "A" },
    visualType: "graph",
    run,
};

export default module;
