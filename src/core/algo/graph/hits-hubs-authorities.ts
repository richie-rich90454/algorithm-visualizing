/**
 * hits-hubs-authorities.ts – HITS Hubs and Authorities
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HITS scores every page two ways: an authority is cited by good hubs, and
 * a hub cites good authorities. Each round sets auth(v) to the hub scores
 * of its in-neighbors and hub(v) to the authority scores of its
 * out-neighbors, then normalizes both vectors to unit length. Scores settle
 * after a few rounds. On A→B, A→C, B→C, C collects the most authority and A
 * the most hub weight.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k·(V + E)) – k power-iteration rounds over all edges
 *   Space: O(V) for the hub and authority vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current authority leader is YELLOW (comparing).
 *   - Final authority top is GREEN (sorted); hub top is PINK (highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Query-dependent: scores come from a focused subgraph, unlike PageRank.
 *   - Normalization each round keeps the values from blowing up.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; iterations?: number } | null) ?? {};
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
    const iters = task.iterations ?? 3;
    let auth = new Map(labels.map((v) => [v, 1]));
    let hub = new Map(labels.map((v) => [v, 1]));
    yield snap("HITS: all hubs and authorities start at 1.", 0, {});
    step += 1;
    for (let k = 1; k <= iters; k += 1) {
        const na = new Map<string, number>();
        const nh = new Map<string, number>();
        for (const v of labels) {
            let a = 0;
            let h = 0;
            for (const u of labels) {
                if ((adjacency[u] ?? []).includes(v)) a += hub.get(u) as number;
                if ((adjacency[v] ?? []).includes(u)) h += auth.get(u) as number;
            }
            na.set(v, a);
            nh.set(v, h);
        }
        const norm = (m: Map<string, number>): Map<string, number> => {
            const s = Math.sqrt([...m.values()].reduce((x, y) => x + y * y, 0)) || 1;
            return new Map(
                [...m.entries()].map(([v, x]) => [v, Math.round((x / s) * 1000) / 1000]),
            );
        };
        auth = norm(na);
        hub = norm(nh);
        clr();
        setN(
            labels.reduce((x, y) => ((auth.get(x) as number) >= (auth.get(y) as number) ? x : y)),
            "comparing",
        );
        yield snap(
            `Round ${k}: auth ${labels.map((v) => `${v}=${auth.get(v)}`).join(", ")} | hub ${labels.map((v) => `${v}=${hub.get(v)}`).join(", ")}.`,
            1,
            { round: k },
        );
        step += 1;
    }
    const topA = labels.reduce((x, y) =>
        (auth.get(x) as number) >= (auth.get(y) as number) ? x : y,
    );
    const topH = labels.reduce((x, y) =>
        (hub.get(x) as number) >= (hub.get(y) as number) ? x : y,
    );
    clr();
    setN(topA, "sorted");
    setN(topH, "highlight");
    yield snap(
        `Top authority ${topA} (${auth.get(topA)}), top hub ${topH} (${hub.get(topH)}).`,
        4,
        { topAuthority: topA, topHub: topH },
    );
}

const module: AlgorithmModule = {
    id: "hits-hubs-authorities",
    name: "HITS Hubs and Authorities",
    category: "graph",
    complexity: { time: "O(k·(V + E))", space: "O(V)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["C"], C: [] }, iterations: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "hub[v] ← 1 and auth[v] ← 1 for every vertex",
        "auth[v] ← hub of in-neighbors; hub[v] ← auth of out-neighbors; normalize",
        "repeat the update for k rounds",
        "read the top authority and the top hub",
        "done: best authority C, best hub A",
    ],
};

export default module;
