/**
 * dsatur-coloring.ts – Graph Coloring (DSATUR)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DSATUR colors vertices one at a time, always picking the uncolored vertex
 * with the most distinctly colored neighbors (its saturation), breaking
 * ties by degree – the most constrained vertex first. The pick then takes
 * the smallest color none of its neighbors uses. On the hub graph, A goes
 * first (degree 3), then B and C force three colors while D reuses one:
 * A=0, B=1, C=2, D=1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²) – each pick scans all uncolored vertices
 *   Space: O(V) for colors and saturation counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being colored is YELLOW (comparing).
 *   - Already colored neighbors show GREEN (sorted).
 *   - Finished colors map to distinct states.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Exact on many small graphs but heuristic in general (NP-hard problem).
 *   - Beats plain greedy orderings by coloring constrained vertices early.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B"],
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
    const color = new Map<string, number>();
    yield snap("DSATUR: repeat – pick max saturation, tie-break by degree.", 0, {});
    step += 1;
    while (color.size < labels.length) {
        let best = "";
        let bestSat = -1;
        let bestDeg = -1;
        for (const v of labels) {
            if (color.has(v)) continue;
            const seen = new Set(
                (adjacency[v] ?? []).map((nb) => color.get(nb)).filter((c) => c !== undefined),
            );
            const deg = (adjacency[v] ?? []).length;
            if (seen.size > bestSat || (seen.size === bestSat && deg > bestDeg)) {
                best = v;
                bestSat = seen.size;
                bestDeg = deg;
            }
        }
        const used = new Set(
            (adjacency[best] ?? []).map((nb) => color.get(nb)).filter((c) => c !== undefined),
        );
        let c = 0;
        while (used.has(c)) c += 1;
        color.set(best, c);
        clr();
        setN(best, "comparing");
        for (const nb of adjacency[best] ?? []) if (color.has(nb)) setN(nb, "sorted");
        yield snap(`${best} has saturation ${bestSat}: takes color ${c}.`, 1, {
            colored: color.size,
            saturation: bestSat,
        });
        step += 1;
    }
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing", "active"];
    for (const [v, c] of color) setN(v, palette[c % palette.length] as EntityState);
    const k = Math.max(...color.values()) + 1;
    yield snap(
        `DSATUR colored with ${k} colors: ${labels.map((v) => `${v}=${color.get(v)}`).join(", ")}.`,
        4,
        { colors: k },
    );
}

const module: AlgorithmModule = {
    id: "dsatur-coloring",
    name: "Graph Coloring (DSATUR)",
    category: "graph",
    complexity: { time: "O(V²)", space: "O(V)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B"], D: ["A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "leave every vertex uncolored",
        "pick the uncolored vertex of max saturation (tie: max degree)",
        "give it the smallest color its neighbors do not use",
        "repeat until every vertex is colored",
        "done: a proper coloring using few colors",
    ],
};

export default module;
