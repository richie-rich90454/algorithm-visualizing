/**
 * ear-decomposition.ts – Ear Decomposition
 *
 * A DFS tree plus each non-tree edge forms an "ear"; together they build
 * the graph path by path. Cycle A–B–C–D–A: spine [A,B,C,D], ear [D,A].
 * Time: O(V + E) Space: O(V + E)
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
    const seen = new Set<string>([start]);
    const tree = new Set<string>();
    const discOrder = [start];
    const tkey = (a: string, b: string): string => [a, b].sort().join("|");
    const stack = [start];
    setN(start, "comparing");
    yield snap(`DFS tree from ${start}: tree edges form the first long ear.`, 0, {});
    step += 1;
    while (stack.length > 0) {
        const u = stack.pop() as string;
        for (const v of adjacency[u] ?? []) {
            if (!seen.has(v)) {
                seen.add(v);
                discOrder.push(v);
                tree.add(tkey(u, v));
                stack.push(v);
                setE(u, v, "active");
                setE(v, u, "active");
                setN(v, "comparing");
            }
        }
    }
    yield snap(
        `DFS discovery order ${discOrder.join("→")}: tree edges form the first long ear.`,
        1,
        {},
    );
    step += 1;
    yield snap(`DFS tree edges: ${[...tree].join(" ")} – every other edge starts an ear.`, 1, {});
    step += 1;
    const ears: string[][] = [];
    const ekey = new Set<string>();
    for (const [u, vs] of Object.entries(adjacency))
        for (const v of vs) {
            const k = tkey(u, v);
            if (!tree.has(k) && !ekey.has(k)) {
                ekey.add(k);
                ears.push([u, v]);
            }
        }
    clr();
    for (const k of tree) {
        const [a, b] = k.split("|") as [string, string];
        setE(a, b, "sorted");
        setE(b, a, "sorted");
    }
    let i = 0;
    for (const [a, b] of ears) {
        i += 1;
        setE(a, b, "path");
        setE(b, a, "path");
        setN(a, "highlight");
        setN(b, "highlight");
        yield snap(`Ear P${i}: ${a}–${b} attaches its endpoints to the built part.`, 2, { ear: i });
        step += 1;
        if (step > 12) break;
    }
    yield snap(`Ear decomposition: spine + ${ears.length} ear(s) rebuild the whole graph.`, 3, {
        ears: ears.length,
    });
}

const module: AlgorithmModule = {
    id: "ear-decomposition",
    name: "Ear Decomposition",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
