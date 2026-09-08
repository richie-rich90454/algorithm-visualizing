/**
 * louvain-community-detection.ts – Louvain Community Detection
 *
 * Phase 1 moves each vertex to the neighboring community with the best
 * modularity gain; phase 2 aggregates. Barbell: {A,B,C} | {D,E,F}.
 * Time: O(V log V) typical Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C", "E", "F"],
        E: ["D", "F"],
        F: ["D", "E"],
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
    const m = Object.values(adjacency).reduce((x, vs) => x + vs.length, 0) / 2;
    const deg = new Map(labels.map((v) => [v, (adjacency[v] ?? []).length]));
    const comm = new Map(labels.map((v) => [v, v]));
    const q = (): number => {
        let s = 0;
        for (const u of labels)
            for (const v of adjacency[u] ?? []) if (comm.get(u) === comm.get(v)) s += 1;
        let pen = 0;
        const tot = new Map<string, number>();
        for (const v of labels)
            tot.set(
                comm.get(v) as string,
                (tot.get(comm.get(v) as string) ?? 0) + (deg.get(v) as number),
            );
        for (const t of tot.values()) pen += (t * t) / (4 * m * m);
        return s / (2 * m) - pen;
    };
    yield snap(
        `Louvain phase 1: ${labels.length} singleton communities, Q=${q().toFixed(3)}.`,
        0,
        {},
    );
    step += 1;
    let moved = true;
    let guard = 0;
    while (moved && guard < 4) {
        moved = false;
        guard += 1;
        for (const v of labels) {
            const home = comm.get(v) as string;
            const options = [...new Set((adjacency[v] ?? []).map((nb) => comm.get(nb) as string))];
            let bestC = home;
            let bestQ = q();
            for (const c of options) {
                if (c === home) continue;
                comm.set(v, c);
                const nq = q();
                if (nq > bestQ + 1e-9) {
                    bestQ = nq;
                    bestC = c;
                }
                comm.set(v, home);
            }
            if (bestC !== home) {
                comm.set(v, bestC);
                moved = true;
                clr();
                setN(v, "comparing");
                for (const u of labels) if (comm.get(u) === bestC && u !== v) setN(u, "sorted");
                yield snap(`${v} joins community ${bestC}: Q=${bestQ.toFixed(3)}.`, 1, {});
                step += 1;
                if (step > 12) break;
            }
        }
        if (step > 12) break;
    }
    const groups = new Map<string, string[]>();
    for (const v of labels) {
        const c = comm.get(v) as string;
        if (!groups.has(c)) groups.set(c, []);
        (groups.get(c) as string[]).push(v);
    }
    clr();
    const palette: EntityState[] = ["sorted", "visited", "highlight"];
    let gi = 0;
    for (const members of groups.values()) {
        for (const x of members) setN(x, palette[gi % palette.length] as EntityState);
        gi += 1;
    }
    yield snap(
        `Phase 2 aggregate: ${[...groups.values()].map((x) => `{${x.sort().join(",")}}`).join(" ")} at Q=${q().toFixed(3)}.`,
        2,
        { communities: groups.size },
    );
}

const module: AlgorithmModule = {
    id: "louvain-community-detection",
    name: "Louvain Community Detection",
    category: "graph",
    complexity: { time: "O(V log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["C", "E", "F"],
            E: ["D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
};

export default module;
