/**
 * k-core-decomposition.ts – K-Core Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The k-core is the largest subgraph where every vertex keeps degree at
 * least k; the core number of a vertex is the deepest core it belongs to.
 * Peeling assigns them: repeatedly remove current minimum-degree vertices,
 * stamping each with the degree at removal time. Later removal means deeper
 * embedding. On the diamond-plus-leaf, D peels at degree 1 while A, B, C
 * survive to degree 2, and the degeneracy (max core number) is 2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) with bucketed degrees
 *   Space: O(V + E) for degrees, core numbers, and survivors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each removed vertex flashes RED (swapped).
 *   - Survivors deepen in color by core number.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Core numbers expose the dense heart of social and web graphs.
 *   - The max core number equals the graph's degeneracy.
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
    const deg = new Map(labels.map((v) => [v, (adjacency[v] ?? []).length]));
    const core = new Map<string, number>();
    const alive = new Set(labels);
    yield snap("Peel minimum-degree vertices; removal round sets core numbers.", 0, {});
    step += 1;
    while (alive.size > 0) {
        let d = Infinity;
        for (const v of alive) d = Math.min(d, deg.get(v) as number);
        const victim = [...alive].sort().find((v) => deg.get(v) === d) as string;
        alive.delete(victim);
        core.set(victim, d);
        for (const nb of adjacency[victim] ?? [])
            if (alive.has(nb) && (deg.get(nb) as number) > d)
                deg.set(nb, (deg.get(nb) as number) - 1);
        setN(victim, "swapped");
        yield snap(`Remove ${victim} at min-degree ${d}: core[${victim}]=${d}.`, 1, {
            remaining: alive.size,
            minDegree: d,
        });
        step += 1;
    }
    const palette: EntityState[] = ["visited", "sorted", "highlight", "comparing"];
    for (const [v, c] of core) setN(v, palette[Math.min(c, palette.length - 1)] as EntityState);
    const degen = Math.max(...core.values());
    yield snap(
        `Core numbers ${labels.map((v) => `${v}=${core.get(v)}`).join(", ")} – degeneracy ${degen}.`,
        4,
        { degeneracy: degen },
    );
}

const module: AlgorithmModule = {
    id: "k-core-decomposition",
    name: "K-Core Decomposition",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B"], D: ["A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "compute every degree; all vertices start alive",
        "remove a minimum-degree vertex, stamp its core number",
        "lower the degrees of its surviving neighbors",
        "repeat until no vertex survives",
        "done: core numbers with degeneracy 2",
    ],
};

export default module;
