/**
 * biconnected-components-hopcroft-tarjan.ts – Biconnected Components
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A biconnected component is a maximal set of edges that stay connected no
 * matter which single vertex is removed. Hopcroft–Tarjan finds them in one
 * depth-first search that stamps every vertex with a discovery number
 * (disc) and a low number (low, the oldest vertex reachable through its
 * subtree), pushing each traversed edge onto a stack. Whenever a child
 * cannot reach above its parent (low[child] ≥ disc[v]), the edges down to
 * that child pop off as one component. On the triangle-plus-tail graph,
 * {A,B,C} pops as one component and {C,D} as another, exposing C as the
 * articulation point between them.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – a single DFS with an edge stack
 *   Space: O(V + E) for discovery/low numbers and the stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being discovered is YELLOW (comparing).
 *   - Tree edges under exploration are BLUE (active).
 *   - Popped components are GREEN (path); articulation points end PINK.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Edge-based sibling of Tarjan's articulation-point test.
 *   - Every biconnected component shares at most one vertex with another.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
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
    const disc = new Map<string, number>();
    const low = new Map<string, number>();
    const edgeStack: Array<[string, string]> = [];
    const comps: string[][][] = [];
    const arts = new Set<string>();
    let time = 0;
    yield snap(`Hopcroft–Tarjan DFS from ${start}: track disc/low on an edge stack.`, 0, {});
    step += 1;
    function* dfs(u: string, parent: string | null): Generator<VisualFrame, void, unknown> {
        time += 1;
        disc.set(u, time);
        low.set(u, time);
        setN(u, "comparing");
        yield snap(`Discover ${u} (disc=${time}).`, 1, { discovered: disc.size });
        step += 1;
        let kids = 0;
        for (const v of adjacency[u] ?? []) {
            if (!disc.has(v)) {
                edgeStack.push([u, v]);
                setE(u, v, "active");
                kids += 1;
                yield* dfs(v, u);
                low.set(u, Math.min(low.get(u) as number, low.get(v) as number));
                if ((low.get(v) as number) >= (disc.get(u) as number)) {
                    if (parent !== null) arts.add(u);
                    else if (kids > 1) arts.add(u);
                    const comp: Array<[string, string]> = [];
                    for (;;) {
                        const e = edgeStack.pop();
                        if (!e) break;
                        comp.push(e);
                        if ((e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) break;
                    }
                    comps.push(comp);
                    for (const [a, b] of comp) {
                        setE(a, b, "path");
                        setE(b, a, "path");
                    }
                    const vs = [...new Set(comp.flat())].sort().join(",");
                    yield snap(`low[${v}] ≥ disc[${u}]: pop biconnected component {${vs}}.`, 2, {
                        components: comps.length,
                    });
                    step += 1;
                }
            } else if (v !== parent && (disc.get(v) as number) < (disc.get(u) as number)) {
                edgeStack.push([u, v]);
                low.set(u, Math.min(low.get(u) as number, disc.get(v) as number));
                setE(u, v, "highlight");
                yield snap(`Back edge ${u}–${v}: low[${u}]=${low.get(u)}.`, 1, {});
                step += 1;
            }
        }
        setN(u, "visited");
    }
    yield* dfs(start, null);
    clr();
    for (const comp of comps)
        for (const [a, b] of comp) {
            setE(a, b, "path");
            setE(b, a, "path");
        }
    for (const a of arts) setN(a, "highlight");
    for (const v of labels) if (!arts.has(v)) setN(v, "sorted");
    const desc = comps.map((c) => `{${[...new Set(c.flat())].sort().join(",")}}`).join(" ");
    yield snap(
        `Biconnected components ${desc}; articulation point C (removing it splits the graph).`,
        4,
        { components: comps.length },
    );
}

const module: AlgorithmModule = {
    id: "biconnected-components-hopcroft-tarjan",
    name: "Biconnected Components (Hopcroft–Tarjan)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "DFS from start with disc/low clocks and an empty edge stack",
        "discover u (stamp disc/low); follow each back edge to update low",
        "low[child] ≥ disc[u]: pop the edge stack into one biconnected component",
        "mark cut vertices found along the way as articulation points",
        "done: edge-disjoint components plus every articulation point",
    ],
};

export default module;
