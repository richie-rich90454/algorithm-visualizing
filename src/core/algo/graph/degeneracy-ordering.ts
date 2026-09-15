/**
 * degeneracy-ordering.ts – Degeneracy Ordering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The degeneracy d of a graph is the smallest number such that every
 * subgraph has a vertex of degree at most d. The ordering peels the graph
 * like an onion: repeatedly remove a minimum-degree vertex and append it to
 * the order. Because each vertex has few neighbors later in the order,
 * greedy coloring along it needs only d+1 colors. On the diamond-plus-leaf
 * graph the peel order witnesses degeneracy 2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) with bucketed degree lists
 *   Space: O(V + E) for degrees and the surviving set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The peeled vertex flashes RED (swapped).
 *   - Survivors waiting for their turn are ORANGE (visited).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Degeneracy bounds the chromatic number: χ ≤ d+1.
 *   - Forests have degeneracy 1; planar graphs at most 5.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B"],
        D: ["A", "B"],
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
    const alive = new Set(labels);
    const order: string[] = [];
    let degen = 0;
    yield snap("Degeneracy ordering: peel a minimum-degree vertex, append to order.", 0, {});
    step += 1;
    while (alive.size > 0) {
        let d = Infinity;
        for (const v of alive) d = Math.min(d, deg.get(v) as number);
        degen = Math.max(degen, d);
        const victim = [...alive].sort().find((v) => deg.get(v) === d) as string;
        alive.delete(victim);
        order.push(victim);
        for (const nb of adjacency[victim] ?? [])
            if (alive.has(nb)) deg.set(nb, (deg.get(nb) as number) - 1);
        clr();
        setN(victim, "swapped");
        for (const v of alive) setN(v, "visited");
        yield snap(`Peel ${victim} (degree ${d}): order [${order.join(", ")}].`, 1, {
            degeneracy: degen,
        });
        step += 1;
    }
    yield snap(
        `Order ${order.join("→")} witnesses degeneracy ${degen}: greedy colors with ${degen + 1}.`,
        4,
        { degeneracy: degen },
    );
}

const module: AlgorithmModule = {
    id: "degeneracy-ordering",
    name: "Degeneracy Ordering",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B"], D: ["A", "B"] },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute every degree; all vertices start alive",
        "peel a minimum-degree vertex and append it to the order",
        "lower the degrees of its surviving neighbors",
        "track the largest minimum degree seen as the degeneracy",
        "done: peel order plus the degeneracy number",
    ],
};

export default module;
