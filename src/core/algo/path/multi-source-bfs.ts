/**
 * multi-source-bfs.ts – Multi-Source BFS
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-source BFS grows one shared wavefront from every source at once.
 * All sources enter a single queue at distance 0; the wavefront that reaches
 * a vertex first owns it and sets its distance and owner. On a line graph
 * with sources A and E, source A claims A, B, C while source E claims D
 * and E, partitioning the graph into Voronoi regions by nearest source.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for one queue pass over the graph
 *   Space: O(V) for distances, owners, and the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Sources start PINK (highlight).
 *   - The vertex spreading its wavefront is YELLOW (comparing).
 *   - Newly reached vertices are ORANGE (visited).
 *   - Finished vertices are GREEN (sorted), then recolored by owner.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Equivalent to adding a super source connected to every source.
 *   - Distances equal the shortest distance to the nearest source.
 *   - Powers Voronoi diagrams, fire spread, and infection modeling.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeGraphEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; sources?: string[] } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "E"],
        E: ["D"],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
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
        yield snap("Empty graph – no wavefront to spread.", 0);
        return;
    }
    const sources = (task.sources ?? ["A", "E"]).filter((s) => labels.includes(s));
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const owner = new Map<string, string>();
    const queue: string[] = [];
    for (const s of sources.length > 0 ? sources : [labels[0] as string]) {
        dist.set(s, 0);
        owner.set(s, s);
        queue.push(s);
        setN(s, "highlight");
    }
    yield snap(
        `Multi-source BFS from sources {${[...owner.keys()].join(", ")}} sharing one queue at distance 0.`,
        0,
        {
            sources: owner.size,
            settled: 0,
            visits: 0,
        },
    );
    step += 1;
    while (queue.length > 0) {
        const u = queue.shift() as string;
        setN(u, "comparing");
        for (const v of adjacency[u] ?? []) {
            if ((dist.get(v) as number) === Infinity) {
                dist.set(v, (dist.get(u) as number) + 1);
                owner.set(v, owner.get(u) as string);
                queue.push(v);
                setN(v, "visited");
            }
        }
        yield snap(
            `Vertex ${u} owned by ${owner.get(u)} at distance ${dist.get(u)} spreads its wavefront to unvisited neighbors.`,
            3,
            {
                distance: dist.get(u) as number,
                settled: labels.filter((v) => (dist.get(v) as number) < Infinity).length,
                visits: step,
            },
        );
        step += 1;
        setN(u, "sorted");
    }
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing"];
    const idx = new Map<string, number>();
    [...owner.values()].forEach((s) => {
        if (!idx.has(s)) idx.set(s, idx.size);
    });
    for (const [v, s] of owner)
        setN(v, palette[(idx.get(s) as number) % palette.length] as EntityState);
    yield snap(
        `Voronoi regions by nearest source: ${[...idx.keys()].map((s) => `${s} owns {${labels.filter((v) => owner.get(v) === s).join(",")}}`).join("; ")}.`,
        6,
        {
            regions: idx.size,
            settled: labels.length,
            visits: labels.length,
            distance: 1,
            path: [...owner.keys()].join("→"),
        },
    );
}

const module: AlgorithmModule = {
    id: "multi-source-bfs",
    name: "Multi-Source BFS",
    category: "shortest-path",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        graph: { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D"] },
        sources: ["A", "E"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "enqueue all sources with distance 0 and owner set",
        "dequeue next vertex u from shared queue",
        "for each neighbor v still unvisited: claim it",
        "set dist[v] ← dist[u]+1 with owner of u",
        "mark u finished, continue with the queue",
        "repeat until the shared queue is empty",
        "done: every vertex maps to its nearest source",
    ],
};

export default module;
