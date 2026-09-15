/**
 * dag-path-counting.ts – Path Counting in a DAG
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Counts how many distinct directed paths connect a source to a target in a
 * directed acyclic graph. Processing vertices in topological order guarantees
 * every predecessor is finished first, so ways[v] equals the sum of ways[u]
 * over all incoming edges u to v. On the demo graph from A to D the answer
 * is 3 distinct paths.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for one topological sort plus one DP pass
 *   Space: O(V + E) for the ordering and the counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being processed is YELLOW (comparing).
 *   - Count propagation edges are BLUE (active).
 *   - Finished vertices are GREEN (sorted).
 *   - The target is CYAN (path) at the end.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Only valid on acyclic graphs; cycles would make counts infinite.
 *   - Each path is extended exactly once, so no double counting occurs.
 *   - The same ordering trick powers shortest and longest paths in DAGs.
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
    yield snap(
        `Topological order from ${start}: ${topo.join(" → ")} so every predecessor comes first.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    const ways = new Map(labels.map((v) => [v, 0]));
    ways.set(start, 1);
    for (const u of topo) {
        setN(u, "comparing");
        for (const v of adjacency[u] ?? []) {
            ways.set(v, (ways.get(v) as number) + (ways.get(u) as number));
            setE(u, v, "active");
        }
        yield snap(
            `Vertex ${u} holds count ways=${ways.get(u)}: pushing its paths to each successor.`,
            3,
            {
                ways: ways.get(u) as number,
                settled: topo.indexOf(u) + 1,
                visits: topo.indexOf(u) + 1,
            },
        );
        step += 1;
        setN(u, "sorted");
    }
    setN(target, "path");
    yield snap(
        `${ways.get(target)} distinct directed paths from ${start} to ${target} through the DAG.`,
        6,
        {
            paths: ways.get(target) as number,
            settled: topo.length,
            visits: topo.length,
            distance: ways.get(target) as number,
            path: `${start}→${target}`,
        },
    );
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
    pseudocode: [
        "compute topological order of all vertices",
        "ways[s] ← 1, ways[v] ← 0 for v not equal to s",
        "process next vertex u in topological order",
        "for each edge u→v: ways[v] ← ways[v] + ways[u]",
        "mark u finished, its count never changes again",
        "repeat until every vertex in order is processed",
        "done: ways[t] holds the total path count",
    ],
};

export default module;
