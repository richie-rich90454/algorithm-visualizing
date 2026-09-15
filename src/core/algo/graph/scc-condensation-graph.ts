/**
 * scc-condensation-graph.ts – SCC Condensation Graph
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Contracting each strongly connected component into a single super-vertex
 * yields the condensation graph – and it is always a DAG, since any cycle
 * between components would have merged them. The pipeline runs Kosaraju's
 * two passes (finish order, then reversed-graph sweep), paints each SCC,
 * and links super-vertices wherever an original edge crosses components.
 * Here {A,B} and {C,D} contract to S0→S1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – Kosaraju plus one edge scan for cross links
 *   Space: O(V + E) for order, components, and links
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The finish-order leader is YELLOW (comparing).
 *   - Each SCC gets its own color; cross-component edges turn GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The condensation DAG unlocks DP over SCCs (reachability, 2-SAT order).
 *   - Sources and sinks of the DAG are the natural start/end blocks.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["D"],
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
    yield snap("Kosaraju pass 1: DFS finish order on the original graph.", 0, {
        vertices: labels.length,
    });
    step += 1;
    const seen = new Set<string>();
    const order: string[] = [];
    const visit = (u: string): void => {
        seen.add(u);
        for (const v of adjacency[u] ?? []) if (!seen.has(v)) visit(v);
        order.push(u);
    };
    for (const v of labels) if (!seen.has(v)) visit(v);
    setN(order[order.length - 1] as string, "comparing");
    yield snap(`Finish order: ${order.join(", ")} – process reversed graph in reverse.`, 1, {
        ordered: order.length,
    });
    step += 1;
    const rev: Record<string, string[]> = {};
    for (const v of labels) rev[v] = [];
    for (const [u, vs] of Object.entries(adjacency))
        for (const v of vs) (rev[v] as string[]).push(u);
    const comp = new Map<string, number>();
    const comps: string[][] = [];
    for (let i = order.length - 1; i >= 0; i -= 1) {
        const s = order[i] as string;
        if (comp.has(s)) continue;
        const members: string[] = [];
        const stack = [s];
        comp.set(s, comps.length);
        while (stack.length > 0) {
            const u = stack.pop() as string;
            members.push(u);
            for (const v of rev[u] ?? [])
                if (!comp.has(v)) {
                    comp.set(v, comps.length);
                    stack.push(v);
                }
        }
        comps.push(members.sort());
        for (const m of members) setN(m, comps.length % 2 === 1 ? "sorted" : "visited");
        yield snap(
            `SCC S${comps.length - 1} = {${members.sort().join(",")}} on the reversed graph.`,
            2,
            { sccs: comps.length },
        );
        step += 1;
    }
    clr();
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing"];
    comps.forEach((members, i) => {
        for (const m of members) setN(m, palette[i % palette.length] as EntityState);
    });
    const links = new Set<string>();
    for (const [u, vs] of Object.entries(adjacency))
        for (const v of vs) {
            const a = comp.get(u) as number;
            const b = comp.get(v) as number;
            if (a !== b) {
                links.add(`${a}→${b}`);
                setE(u, v, "path");
            }
        }
    yield snap(
        `Condensation DAG: ${comps.map((m, i) => `S${i}={${m.join(",")}}`).join(" ")} with edge ${[...links].join(", ")}.`,
        4,
        { sccs: comps.length },
    );
}

const module: AlgorithmModule = {
    id: "scc-condensation-graph",
    name: "SCC Condensation Graph",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C"], C: ["D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "run Kosaraju pass 1: DFS finish order on the original graph",
        "sweep the reversed graph in reverse finish order into SCCs",
        "contract each SCC into one super-vertex",
        "link super-vertices wherever an edge crosses components",
        "done: the condensation DAG such as S0={A,B} → S1={C,D}",
    ],
};

export default module;
