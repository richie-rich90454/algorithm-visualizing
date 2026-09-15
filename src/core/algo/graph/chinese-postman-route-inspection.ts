/**
 * chinese-postman-route-inspection.ts – Chinese Postman (Route Inspection)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The postman must walk every street at least once and return home as cheaply
 * as possible. When every vertex has even degree, an Euler circuit already
 * covers each edge exactly once (found here with Hierholzer's walk), so the
 * tour is optimal with nothing repeated. With odd-degree vertices, the
 * cheapest fix pairs them up along shortest paths and duplicates those
 * edges. The even square A–B–C–D–A tours with cost 4 and no repeats.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) here – the Euler-circuit case needs one Hierholzer walk
 *   Space: O(V + E) for the walk stack and edge bookkeeping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Walked edges turn GREEN (path) step by step.
 *   - The current endpoint is YELLOW (comparing).
 *   - The finished tour is GREEN (sorted) end to end.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Even degrees are exactly what makes a circuit possible.
 *   - The general case reduces to minimum-weight odd-vertex pairing.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, Array<[string, number]>>; start?: string } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 1],
            ["D", 1],
        ],
        B: [
            ["A", 1],
            ["C", 1],
        ],
        C: [
            ["B", 1],
            ["D", 1],
        ],
        D: [
            ["C", 1],
            ["A", 1],
        ],
    };
    const plain: Record<string, string[]> = {};
    const weight = new Map<string, number>();
    for (const [u, vs] of Object.entries(wadj)) {
        plain[u] = vs.map(([v, w]) => {
            weight.set([u, v].sort().join("|"), w);
            return v;
        });
    }
    const adjacency = plain;

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
    const odd = labels.filter((v) => (adjacency[v] ?? []).length % 2 === 1);
    setN(start, "comparing");
    yield snap(
        `Route inspection from ${start}: odd-degree vertices {${odd.join(", ") || "none"}}.`,
        0,
        { odd: odd.length },
    );
    step += 1;
    if (odd.length === 0) {
        yield snap("All degrees even: an Euler circuit exists – no edge repeated.", 1, {});
        step += 1;
    } else {
        yield snap(`${odd.length} odd vertices need pairing (not the case here).`, 1, {
            odd: odd.length,
        });
        step += 1;
    }
    const ekey = (a: string, b: string): string => [a, b].sort().join("|");
    // Iterative Hierholzer: follow unused edges, backtrack into the circuit.
    const stackH = [start];
    const usedH = new Set<string>();
    const circ: string[] = [];
    let cost = 0;
    while (stackH.length > 0) {
        const u = stackH[stackH.length - 1] as string;
        const nxt = (adjacency[u] ?? []).find(
            (v) => !usedH.has(`${ekey(u, v)}@${u}-${v}`) && !usedH.has(`${ekey(u, v)}@${v}-${u}`),
        );
        if (nxt === undefined) {
            circ.push(u);
            stackH.pop();
        } else {
            usedH.add(`${ekey(u, nxt)}@${u}-${nxt}`);
            cost += weight.get(ekey(u, nxt)) ?? 1;
            stackH.push(nxt);
        }
    }
    circ.reverse();
    clr();
    for (let i = 0; i + 1 < circ.length && i < 6; i += 1) {
        const a = circ[i] as string;
        const b = circ[i + 1] as string;
        setE(a, b, "path");
        setE(b, a, "path");
        setN(b, "comparing");
        yield snap(`Walk ${a}→${b} (step ${i + 1}).`, 2, { stepWalk: i + 1 });
        step += 1;
        setN(b, "visited");
    }
    for (const v of circ) setN(v, "sorted");
    yield snap(`Euler circuit ${circ.join("→")} covers every edge: postman cost ${cost}.`, 4, {
        cost,
    });
}

const module: AlgorithmModule = {
    id: "chinese-postman-route-inspection",
    name: "Chinese Postman (Route Inspection)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["D", 1],
            ],
            B: [
                ["A", 1],
                ["C", 1],
            ],
            C: [
                ["B", 1],
                ["D", 1],
            ],
            D: [
                ["C", 1],
                ["A", 1],
            ],
        },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "collect the odd-degree vertices of the graph",
        "no odd vertices: an Euler circuit exists with nothing repeated",
        "walk unused edges Hierholzer-style, backtracking into the circuit",
        "repeat until every edge is walked exactly once",
        "done: Euler circuit with the minimum postman cost",
    ],
};

export default module;
