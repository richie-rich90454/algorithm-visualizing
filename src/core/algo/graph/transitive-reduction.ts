/**
 * transitive-reduction.ts – Transitive Reduction (DAG)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The transitive reduction strips a DAG to its skeleton: drop every edge
 * u→v whose endpoints stay connected by a longer path, keeping only edges
 * no detour can replace. Each edge is tested by deleting it and checking
 * whether v is still reachable from u. On A→B→C plus the shortcut A→C, the
 * shortcut drops while A→B and B→C survive as essential.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·(V + E)) – one reachability check per edge
 *   Space: O(V + E) for the reachability sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge under test is YELLOW (comparing).
 *   - Redundant edges flash RED (swapped); kept edges turn GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Unique for DAGs; the Hasse diagram of the reachability order.
 *   - The inverse operation of transitive closure.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? { A: ["B", "C"], B: ["C"], C: [] };

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
    const reach = (skip: [string, string] | null): Map<string, Set<string>> => {
        const r = new Map(labels.map((v) => [v, new Set<string>()]));
        for (const [u, vs] of Object.entries(adjacency)) {
            for (const v of vs) {
                if (skip && skip[0] === u && skip[1] === v) continue;
                (r.get(u) as Set<string>).add(v);
            }
        }
        for (const k of labels)
            for (const i of labels) {
                if (!(r.get(i) as Set<string>).has(k)) continue;
                for (const j of r.get(k) as Set<string>) (r.get(i) as Set<string>).add(j);
            }
        return r;
    };
    const kept: Array<[string, string]> = [];
    const dropped: Array<[string, string]> = [];
    yield snap("Test each edge: redundant iff its target stays reachable without it.", 0, {});
    step += 1;
    for (const [u, vs] of Object.entries(adjacency)) {
        for (const v of vs) {
            const without = reach([u, v]);
            clr();
            setE(u, v, "comparing");
            if ((without.get(u) as Set<string>).has(v)) {
                dropped.push([u, v]);
                setE(u, v, "swapped");
                yield snap(
                    `Edge ${u}→${v} is redundant: ${u} still reaches ${v} via a longer path.`,
                    1,
                    { dropped: dropped.length },
                );
            } else {
                kept.push([u, v]);
                setE(u, v, "path");
                yield snap(`Edge ${u}→${v} is essential: no alternative ${u}⇝${v} path.`, 1, {
                    kept: kept.length,
                });
            }
            step += 1;
        }
    }
    clr();
    for (const [u, v] of kept) setE(u, v, "path");
    for (const [u, v] of dropped) setE(u, v, "swapped");
    yield snap(
        `Reduction keeps ${kept.map(([u, v]) => `${u}→${v}`).join(", ") || "∅"}; drops ${dropped.map(([u, v]) => `${u}→${v}`).join(", ") || "∅"}.`,
        4,
        { kept: kept.length },
    );
}

const module: AlgorithmModule = {
    id: "transitive-reduction",
    name: "Transitive Reduction (DAG)",
    category: "graph",
    complexity: { time: "O(V·(V + E))", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["C"], C: [] } },
    visualType: "graph",
    run,
    pseudocode: [
        "list every edge as a candidate",
        "hide u→v: redundant iff v stays reachable from u without it",
        "repeat the reachability test for every edge",
        "collect the kept edges and the dropped shortcuts",
        "done: the skeleton, e.g. A→B and B→C without A→C",
    ],
};

export default module;
