/**
 * connected-components-union-find.ts – Connected Components (Union-Find)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A connected component is a maximal group of vertices joined by paths. The
 * union-find approach starts with every vertex in its own singleton set,
 * then unions the endpoints of each edge (with path compression keeping the
 * trees flat). Vertices sharing a root representative belong to one
 * component. Here edge A–B merges {A,B}, edge C–D merges {C,D}, and E stands
 * alone: 3 components after 2 merges.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E·α(V)) – nearly linear thanks to path compression
 *   Space: O(V) for parent pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex under inspection is YELLOW (comparing).
 *   - Merged edges turn BLUE (active).
 *   - Each finished component gets its own color.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - α(V), the inverse Ackermann function, is below 5 for any real input.
 *   - Union-find also powers Kruskal's algorithm and dynamic connectivity.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A"],
        C: ["D"],
        D: ["C"],
        E: [],
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
    const parent = new Map(labels.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        let c = x;
        while (parent.get(c) !== r) {
            const nxt = parent.get(c) as string;
            parent.set(c, r);
            c = nxt;
        }
        return r;
    };
    yield snap(`Union-Find over ${labels.length} singleton sets.`, 0, { sets: labels.length });
    step += 1;
    const seen = new Set<string>();
    let merges = 0;
    for (const u of labels) {
        setN(u, "comparing");
        for (const v of adjacency[u] ?? []) {
            const key = [u, v].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            const ru = find(u);
            const rv = find(v);
            if (ru !== rv) {
                parent.set(rv, ru);
                merges += 1;
                setE(u, v, "active");
                setN(v, "visited");
                yield snap(`Union(${u}, ${v}): merged set ${rv} into ${ru}.`, 1, { merges });
                step += 1;
            }
        }
        const root = find(u);
        void root;
        setN(u, "sorted");
    }
    const comps = new Map<string, string[]>();
    yield snap(`All edges scanned – reading each vertex's root representative.`, 2, { merges });
    step += 1;
    for (const v of labels) {
        const r = find(v);
        if (!comps.has(r)) comps.set(r, []);
        (comps.get(r) as string[]).push(v);
    }
    clr();
    const palette: EntityState[] = ["sorted", "visited", "highlight"];
    let ci = 0;
    const parts: string[] = [];
    for (const members of comps.values()) {
        for (const m of members) setN(m, palette[ci % palette.length] as EntityState);
        parts.push(`{${members.join(",")}}`);
        ci += 1;
    }
    yield snap(`${comps.size} components: ${parts.join(" ")} after ${merges} merges.`, 4, {
        components: comps.size,
        merges,
    });
}

const module: AlgorithmModule = {
    id: "connected-components-union-find",
    name: "Connected Components (Union-Find)",
    category: "graph",
    complexity: { time: "O(E α(V))", space: "O(V)" },
    defaultInput: { graph: { A: ["B"], B: ["A"], C: ["D"], D: ["C"], E: [] } },
    visualType: "graph",
    run,
    pseudocode: [
        "make every vertex its own singleton set",
        "for each edge (u, v): union the sets of u and v",
        "all edges scanned: read each vertex's root representative",
        "group vertices that share a root into components",
        "done: every component listed with its member vertices",
    ],
};

export default module;
