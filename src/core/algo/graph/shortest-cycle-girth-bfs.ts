/**
 * shortest-cycle-girth-bfs.ts – Shortest Cycle / Girth (BFS)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The girth is the length of the shortest cycle in the graph (infinite when
 * acyclic). The algorithm runs BFS from every source: BFS layers give
 * distances, and any non-tree edge u–v joining two visited branches closes
 * a cycle of length dist[u]+dist[v]+1. The minimum over all sources is the
 * girth. On the triangle-plus-tail, the triangle edges close length-3
 * cycles, so the girth is 3.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·(V + E)) – one BFS per source
 *   Space: O(V + E) for distances, parents, and the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The BFS source is PINK (highlight).
 *   - The closing edge of the best cycle turns GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Generalizes unweighted shortest paths to shortest closed walks.
 *   - A tree (or forest) reports infinite girth: no cycle to close.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C"],
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
    const nbr = (v: string): string[] => adjacency[v] ?? [];
    let girth = Infinity;
    let witness = "";
    yield snap("Girth = length of the shortest cycle: BFS from every source.", 0, {});
    step += 1;
    for (const s of labels) {
        const dist = new Map(labels.map((v) => [v, -1]));
        const parent = new Map<string, string | null>(labels.map((v) => [v, null]));
        dist.set(s, 0);
        const queue = [s];
        let best = Infinity;
        let edge = "";
        while (queue.length > 0) {
            const u = queue.shift() as string;
            for (const v of nbr(u)) {
                if ((dist.get(v) as number) < 0) {
                    dist.set(v, (dist.get(u) as number) + 1);
                    parent.set(v, u);
                    queue.push(v);
                } else if (parent.get(u) !== v && parent.get(v) !== u && u < v) {
                    const cyc = (dist.get(u) as number) + (dist.get(v) as number) + 1;
                    if (cyc > 2 && cyc < best) {
                        best = cyc;
                        edge = `${u}–${v}`;
                    }
                }
            }
        }
        clr();
        setN(s, "highlight");
        if (best < Infinity) {
            const [a, b] = edge.split("–") as [string, string];
            setE(a, b, "path");
            setE(b, a, "path");
            if (best < girth) {
                girth = best;
                witness = edge;
            }
            yield snap(
                `From ${s}: shortest cycle through ${s} has length ${best} (closes at ${edge}).`,
                1,
                { best },
            );
        } else {
            yield snap(`From ${s}: no cycle found (tree-like view).`, 1, { best: -1 });
        }
        step += 1;
    }
    clr();
    if (witness !== "") {
        const [a, b] = witness.split("–") as [string, string];
        setE(a, b, "path");
        setE(b, a, "path");
    }
    yield snap(
        girth < Infinity
            ? `Girth = ${girth}: the triangle closes at ${witness}.`
            : "Acyclic – girth is infinite.",
        4,
        { girth: girth < Infinity ? girth : -1, witness: witness || "none" },
    );
}

const module: AlgorithmModule = {
    id: "shortest-cycle-girth-bfs",
    name: "Shortest Cycle / Girth (BFS)",
    category: "graph",
    complexity: { time: "O(V·(V + E))", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "set up one BFS per source vertex",
        "BFS from s: each cross edge u–v closes dist[u]+dist[v]+1",
        "keep the shortest cycle seen through s",
        "repeat for every source and keep the global minimum",
        "done: the girth and its witness edge",
    ],
};

export default module;
