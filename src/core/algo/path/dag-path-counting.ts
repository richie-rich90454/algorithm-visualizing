/**
 * dag-path-counting.ts – Path Counting in a DAG
 *
 * In topological order, ways[v] = Σ ways[u] over incoming edges: each
 * path is extended exactly once. A→D admits 3 distinct paths.
 * Time: O(V + E) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeGraphEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, string[]>; start?: string; target?: string } | null) ??
        {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["C", "D"],
        C: ["D"],
        D: [],
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
        yield snap("Empty DAG – no paths to count.", 0);
        return;
    }
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "D";
    const indeg = new Map(labels.map((v) => [v, 0]));
    for (const vs of Object.values(adjacency))
        for (const v of vs) indeg.set(v, (indeg.get(v) as number) + 1);
    const topo: string[] = [];
    const queue = labels.filter((v) => indeg.get(v) === 0);
    const indegM = new Map(indeg);
    while (queue.length > 0) {
        const u = queue.shift() as string;
        topo.push(u);
        for (const v of adjacency[u] ?? []) {
            indegM.set(v, (indegM.get(v) as number) - 1);
            if (indegM.get(v) === 0) queue.push(v);
        }
    }
    yield snap(`Topological order: ${topo.join("→")} – DP follows it.`, 0, {});
    step += 1;
    const ways = new Map(labels.map((v) => [v, 0]));
    ways.set(start, 1);
    for (const u of topo) {
        setN(u, "comparing");
        for (const v of adjacency[u] ?? []) {
            ways.set(v, (ways.get(v) as number) + (ways.get(u) as number));
            setE(u, v, "active");
        }
        yield snap(`ways[${u}]=${ways.get(u)}: push to successors.`, 1, {
            ways: ways.get(u) as number,
        });
        step += 1;
        setN(u, "sorted");
    }
    setN(target, "path");
    yield snap(`${ways.get(target)} distinct directed paths from ${start} to ${target}.`, 2, {
        paths: ways.get(target) as number,
    });
}

const module: AlgorithmModule = {
    id: "dag-path-counting",
    name: "Path Counting in a DAG",
    category: "shortest-path",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "C"], B: ["C", "D"], C: ["D"], D: [] },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
};

export default module;
