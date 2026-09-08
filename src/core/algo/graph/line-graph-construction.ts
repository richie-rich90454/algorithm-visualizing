/**
 * line-graph-construction.ts – Line Graph Construction
 *
 * Each edge becomes a vertex; two are adjacent when the edges share an
 * endpoint. Star K1,3 becomes a triangle on {AB, AC, AD}.
 * Time: O(V + E²) Space: O(E²)
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
    const seenE = new Set<string>();
    const origEdges: Array<[string, string]> = [];
    for (const [u, vs] of Object.entries(adjacency)) {
        for (const v of vs) {
            const k = [u, v].sort().join("|");
            if (!seenE.has(k)) {
                seenE.add(k);
                origEdges.push([u, v]);
            }
        }
    }
    yield snap(`Star has ${origEdges.length} edges: each becomes one line-graph vertex.`, 0, {
        edges: origEdges.length,
    });
    step += 1;
    for (const [u, v] of origEdges) {
        setE(u, v, "active");
        setN(u, "comparing");
        setN(v, "comparing");
        yield snap(`Edge ${u}–${v} becomes line-graph vertex e${u}${v}.`, 1, {});
        step += 1;
    }
    yield snap(
        `Edges ${origEdges.map(([u, v]) => `${u}${v}`).join(", ")} all share A – pairwise adjacent in L(G).`,
        1,
        {},
    );
    step += 1;
    // Final frames render the line graph itself: vertices eAB, eAC, eAD.
    const lgNodes = makeGraphNodes(origEdges.map(([u, v]) => `e${u}${v}`));
    const lgAdj: Record<string, string[]> = {};
    for (const [u, v] of origEdges) lgAdj[`e${u}${v}`] = [];
    for (let i = 0; i < origEdges.length; i += 1) {
        for (let j = i + 1; j < origEdges.length; j += 1) {
            const [a, b] = origEdges[i] as [string, string];
            const [c, d] = origEdges[j] as [string, string];
            if (a === c || a === d || b === c || b === d) {
                (lgAdj[`e${a}${b}`] as string[]).push(`e${c}${d}`);
                (lgAdj[`e${c}${d}`] as string[]).push(`e${a}${b}`);
            }
        }
    }
    const lgEdges = makeGraphEdges(lgAdj);
    for (const n of lgNodes) n.state = "sorted";
    for (const e of lgEdges) e.state = "path";
    yield {
        stepNumber: step,
        entities: lgNodes.map((n) => ({ ...n })),
        edges: lgEdges.map((e) => ({ ...e })),
        description: `Line graph L(G): ${lgNodes.length} vertices, ${lgEdges.length / 2} adjacencies – a triangle.`,
        codeLineNumber: 2,
        layout: "graph" as const,
        meta: { vertices: lgNodes.length },
    };
}

const module: AlgorithmModule = {
    id: "line-graph-construction",
    name: "Line Graph Construction",
    category: "graph",
    complexity: { time: "O(V + E²)", space: "O(E²)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] } },
    visualType: "graph",
    run,
};

export default module;
