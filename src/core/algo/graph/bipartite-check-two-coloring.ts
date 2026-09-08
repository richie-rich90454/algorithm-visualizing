/**
 * bipartite-check-two-coloring.ts – Bipartite Check (Two-Coloring)
 *
 * BFS paints each vertex the opposite color of its parent; an edge joining
 * equal colors proves an odd cycle. Even square here → bipartite.
 * Time: O(V + E) Space: O(V)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "A"],
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
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const color = new Map<string, number>([[start, 0]]);
    const queue = [start];
    setN(start, "comparing");
    yield snap(`Two-coloring from ${start} (color 0).`, 0, { colored: 1 });
    step += 1;
    let ok = true;
    let bad = "";
    while (queue.length > 0 && ok) {
        const cur = queue.shift();
        if (cur === undefined) break;
        const cc = color.get(cur) ?? 0;
        setN(cur, "comparing");
        for (const nb of adjacency[cur] ?? []) {
            if (!color.has(nb)) {
                color.set(nb, 1 - cc);
                queue.push(nb);
                setE(cur, nb, "active");
                setN(nb, "visited");
                yield snap(`${nb} gets color ${1 - cc} (opposite of ${cur}).`, 1, {
                    colored: color.size,
                });
                step += 1;
            } else if (color.get(nb) === cc) {
                ok = false;
                bad = `${cur}–${nb}`;
                setE(cur, nb, "swapped");
                yield snap(`Conflict on edge ${bad}: both ends color ${cc} – odd cycle.`, 2, {});
                step += 1;
                break;
            }
        }
        setN(cur, cc === 0 ? "sorted" : "visited");
    }
    clr();
    for (const [v, c] of color) setN(v, c === 0 ? "sorted" : "visited");
    yield snap(
        ok
            ? `Bipartite: color-0 {${labels.filter((v) => color.get(v) === 0).join(",")}} color-1 {${labels.filter((v) => color.get(v) === 1).join(",")}}.`
            : `Not bipartite – odd cycle at ${bad}.`,
        3,
        { bipartite: ok },
    );
}

const module: AlgorithmModule = {
    id: "bipartite-check-two-coloring",
    name: "Bipartite Check (Two-Coloring)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
