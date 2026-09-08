/**
 * multi-source-bfs.ts – Multi-Source BFS
 *
 * All sources enter one queue at distance 0; the wavefront that reaches a
 * vertex first owns it. Line with sources A, E: A owns A/B/C, E owns D/E.
 * Time: O(V + E) Space: O(V)
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
    yield snap(`Multi-source BFS from {${[...owner.keys()].join(", ")}}: one shared queue.`, 0, {
        sources: owner.size,
    });
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
        yield snap(`${u} (owner ${owner.get(u)}, dist ${dist.get(u)}) spreads its wavefront.`, 1, {
            distance: dist.get(u) as number,
        });
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
        `Voronoi regions: ${[...idx.keys()].map((s) => `${s}→{${labels.filter((v) => owner.get(v) === s).join(",")}}`).join(" ")}.`,
        2,
        { regions: idx.size },
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
};

export default module;
