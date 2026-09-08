/**
 * connected-components-union-find.ts – Connected Components (Union-Find)
 *
 * Disjoint-set union merges each edge's endpoints with path compression;
 * vertices sharing a root form one component. Here: 3 components.
 * Time: O(E α(V)) Space: O(V)
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
    yield snap(`${comps.size} components: ${parts.join(" ")} after ${merges} merges.`, 2, {
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
};

export default module;
