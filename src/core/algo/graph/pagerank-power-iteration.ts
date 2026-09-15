/**
 * pagerank-power-iteration.ts – PageRank (Power Iteration)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PageRank models a random surfer: with probability d follow a random
 * out-link, else teleport anywhere. Each round sets rank(v) to (1−d)/n plus
 * d times the rank flowing in from in-neighbors, split by their out-degree.
 * Repeated rounds converge to the dominant eigenvector – the long-run visit
 * shares. On the symmetric 3-cycle every vertex settles at 1/3.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k·(V + E)) – k power-iteration rounds over all edges
 *   Space: O(V) for the rank vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The round leader is YELLOW (comparing); the rest ORANGE (visited).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Damping (usually 0.85) guarantees convergence on any graph.
 *   - Dangling vertices (no out-links) leak rank without special handling.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, string[]>;
            damping?: number;
            iterations?: number;
        } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? { A: ["B"], B: ["C"], C: ["A"] };

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
    const d = task.damping ?? 0.85;
    const iters = task.iterations ?? 3;
    const n = labels.length;
    let rank = new Map(labels.map((v) => [v, 1 / n]));
    yield snap(`PageRank d=${d}: every node starts at ${(1 / n).toFixed(3)}.`, 0, {});
    step += 1;
    for (let k = 1; k <= iters; k += 1) {
        const next = new Map<string, number>();
        for (const v of labels) {
            let s = 0;
            for (const u of labels) {
                const out = adjacency[u] ?? [];
                if (out.includes(v)) s += (rank.get(u) as number) / out.length;
            }
            next.set(v, (1 - d) / n + d * s);
        }
        rank = next;
        clr();
        const mx = Math.max(...rank.values());
        for (const [v, r] of rank) setN(v, r === mx ? "comparing" : "visited");
        yield snap(
            `Iteration ${k}: ${labels.map((v) => `${v}=${(rank.get(v) as number).toFixed(3)}`).join(", ")}.`,
            1,
            { iteration: k },
        );
        step += 1;
    }
    yield snap(
        `PageRank converged: ${labels.map((v) => `${v}≈${(rank.get(v) as number).toFixed(3)}`).join(", ")} (uniform on a symmetric cycle).`,
        4,
        { ranks: labels.map((v) => `${v}:${(rank.get(v) as number).toFixed(3)}`) },
    );
}

const module: AlgorithmModule = {
    id: "pagerank-power-iteration",
    name: "PageRank (Power Iteration)",
    category: "graph",
    complexity: { time: "O(k·(V + E))", space: "O(V)" },
    defaultInput: { graph: { A: ["B"], B: ["C"], C: ["A"] }, damping: 0.85, iterations: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "rank[v] ← 1/n for every vertex",
        "rank[v] ← (1−d)/n + d times incoming rank shares; repeat k rounds",
        "the leader changes as rank flows along the links",
        "check that the values have settled",
        "done: converged ranks such as A≈B≈C≈0.333",
    ],
};

export default module;
