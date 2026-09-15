/**
 * greedy-coloring-welsh-powell.ts – Greedy Coloring (Welsh–Powell)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Welsh–Powell colors high-degree vertices first: sort all vertices by
 * descending degree, then walk the order giving each vertex the smallest
 * color none of its already-colored neighbors uses. Big hubs commit early,
 * which keeps the color count low on many real graphs. Hub A (degree 3)
 * goes first here: A=0, then B=1, C=2, and D reuses 1 – 3 colors, optimal
 * for this graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²) – sorting plus a neighbor scan per vertex
 *   Space: O(V) for the order and colors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex taking a color is YELLOW (comparing).
 *   - Finished vertices stay GREEN (sorted) until the final palette lands.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Fast heuristic for an NP-hard problem; not always optimal.
 *   - Degree order beats arbitrary order on dense, uneven graphs.
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
    const order = [...labels].sort(
        (a, b) => (adjacency[b]?.length ?? 0) - (adjacency[a]?.length ?? 0),
    );
    yield snap(
        `Welsh–Powell order by degree: ${order.map((v) => `${v}(${(adjacency[v] ?? []).length})`).join(", ")}.`,
        0,
        {},
    );
    step += 1;
    const color = new Map<string, number>();
    for (const v of order) {
        const used = new Set(
            (adjacency[v] ?? []).map((nb) => color.get(nb)).filter((c) => c !== undefined),
        );
        let c = 0;
        while (used.has(c)) c += 1;
        color.set(v, c);
        setN(v, "comparing");
        for (const nb of adjacency[v] ?? []) if (color.get(nb) === c) setE(v, nb, "swapped");
        yield snap(
            `${v} takes smallest free color ${c} (neighbors use {${[...used].join(",")}}).`,
            1,
            { colored: color.size, colors: Math.max(...color.values()) + 1 },
        );
        step += 1;
        setN(v, "sorted");
    }
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing", "active"];
    for (const [v, c] of color) setN(v, palette[c % palette.length] as EntityState);
    const k = Math.max(...color.values()) + 1;
    yield snap(
        `Colored with ${k} colors: ${order.map((v) => `${v}=${color.get(v)}`).join(", ")}.`,
        4,
        { colors: k },
    );
}

const module: AlgorithmModule = {
    id: "greedy-coloring-welsh-powell",
    name: "Greedy Coloring (Welsh–Powell)",
    category: "graph",
    complexity: { time: "O(V²)", space: "O(V)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B"], D: ["A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "sort vertices by descending degree into the Welsh–Powell order",
        "give each vertex the smallest color its neighbors do not use",
        "repeat until every vertex is colored",
        "count the distinct colors used",
        "done: a proper coloring such as A=0, B=1, C=2, D=1",
    ],
};

export default module;
