/**
 * closeness-centrality.ts – Closeness Centrality
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Closeness centrality rewards vertices that reach everyone else in few
 * hops: closeness[v] = (n−1) / total-distance(v), the inverse of the average
 * distance to all others. The algorithm runs one breadth-first search from
 * every vertex, sums the distances, and normalizes. On the star, center A
 * reaches all three leaves in 1 hop (score 1.0) while each leaf needs 1 + 2
 * + 2 = 5 hops (score 3/5 = 0.6).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·(V + E)) – one BFS per vertex
 *   Space: O(V) for distances and scores
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The BFS source is YELLOW (comparing); the rest are ORANGE (visited).
 *   - The top scorer finishes GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Needs a connected graph; isolated vertices have infinite distance.
 *   - Complements betweenness: reach speed versus bridge control.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A"],
        C: ["A"],
        D: ["A"],
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
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
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
    const bfs = (s: string): Map<string, number> => {
        const dist = new Map(labels.map((v) => [v, Infinity]));
        dist.set(s, 0);
        const q = [s];
        while (q.length > 0) {
            const v = q.shift() as string;
            for (const w of adjacency[v] ?? []) {
                if ((dist.get(w) as number) === Infinity) {
                    dist.set(w, (dist.get(v) as number) + 1);
                    q.push(w);
                }
            }
        }
        return dist;
    };
    const close = new Map<string, number>();
    yield snap("Closeness = (n−1) / total distance: BFS from every vertex.", 0, {});
    step += 1;
    for (const s of labels) {
        const dist = bfs(s);
        let sum = 0;
        for (const v of labels) if (v !== s) sum += dist.get(v) as number;
        const c = sum > 0 ? (labels.length - 1) / sum : 0;
        close.set(s, Math.round(c * 100) / 100);
        clr();
        setN(s, "comparing");
        for (const v of labels) if (v !== s) setN(v, "visited");
        yield snap(`From ${s}: total distance ${sum} → closeness ${close.get(s)}.`, 1, {
            totalDistance: sum,
        });
        step += 1;
    }
    const mx = Math.max(...close.values());
    for (const [v, c] of close) setN(v, c === mx ? "sorted" : "visited");
    yield snap(
        `Closeness: ${labels.map((v) => `${v}=${close.get(v)}`).join(", ")} – center A reaches all in 1 hop.`,
        4,
        { scores: labels.map((v) => `${v}:${close.get(v)}`), max: mx },
    );
}

const module: AlgorithmModule = {
    id: "closeness-centrality",
    name: "Closeness Centrality",
    category: "graph",
    complexity: { time: "O(V·(V + E))", space: "O(V)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "set up one BFS per vertex over the whole graph",
        "BFS from s: total its distances, closeness[s] ← (n−1) / total",
        "repeat for every vertex s",
        "keep the vertex with the largest closeness value",
        "done: center A scores 1.0, each leaf scores 0.6",
    ],
};

export default module;
