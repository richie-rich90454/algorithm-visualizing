/**
 * transitive-closure.ts – Transitive Closure (Warshall)
 *
 * Warshall's rule: if i reaches k and k reaches j, link i→j. Chain
 * A→B→C gains the shortcut A→C – reachability made explicit.
 * Time: O(V³) Space: O(V²)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? { A: ["B"], B: ["C"], C: [] };

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
    const reach = new Map(labels.map((v) => [v, new Set(adjacency[v] ?? [])]));
    yield snap(`Warshall closure: ${labels.length} vertices, one round per intermediate k.`, 0, {});
    step += 1;
    for (const k of labels) {
        clr();
        setN(k, "highlight");
        let added = 0;
        for (const i of labels) {
            if (!(reach.get(i) as Set<string>).has(k)) continue;
            for (const j of labels) {
                if (
                    (reach.get(k) as Set<string>).has(j) &&
                    !(reach.get(i) as Set<string>).has(j) &&
                    i !== j
                ) {
                    (reach.get(i) as Set<string>).add(j);
                    added += 1;
                }
            }
        }
        for (const i of labels) for (const j of reach.get(i) as Set<string>) setE(i, j, "active");
        yield snap(
            added > 0 ? `Via ${k}: ${added} new reachability edge(s).` : `Via ${k}: nothing new.`,
            1,
            { through: k },
        );
        step += 1;
    }
    const all: string[] = [];
    for (const i of labels) for (const j of reach.get(i) as Set<string>) all.push(`${i}→${j}`);
    yield snap(`Closure complete: reachable pairs ${all.sort().join(", ")}.`, 2, {
        pairs: all.length,
    });
}

const module: AlgorithmModule = {
    id: "transitive-closure",
    name: "Transitive Closure (Warshall)",
    category: "graph",
    complexity: { time: "O(V³)", space: "O(V²)" },
    defaultInput: { graph: { A: ["B"], B: ["C"], C: [] } },
    visualType: "graph",
    run,
};

export default module;
