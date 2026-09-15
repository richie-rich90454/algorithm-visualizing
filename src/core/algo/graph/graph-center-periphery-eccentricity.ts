/**
 * graph-center-periphery-eccentricity.ts – Center / Periphery (Eccentricity)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The eccentricity ecc[v] is the farthest distance from v to anyone – the
 * worst-case trip starting at v. The smallest eccentricity is the radius,
 * achieved by the center vertices; the largest is the diameter, achieved by
 * the periphery. One breadth-first search per vertex fills the table. On
 * the path A–B–C–D–E, C reaches everyone within 2 hops (radius 2, the
 * center) while A and E need 4 hops (diameter 4, the periphery).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·(V + E)) – one BFS per vertex
 *   Space: O(V) for distances and eccentricities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The BFS source is YELLOW (comparing).
 *   - Center vertices finish GREEN (sorted); periphery PINK (highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Radius ≤ diameter ≤ 2·radius always holds.
 *   - The center minimizes the worst-case distance: the 1-center problem.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "E"],
        E: ["D"],
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
    yield snap("Eccentricity = farthest distance: BFS from every vertex.", 0, {});
    step += 1;
    const ecc = new Map<string, number>();
    for (const s of labels) {
        const dist = new Map(labels.map((v) => [v, Infinity]));
        dist.set(s, 0);
        const q = [s];
        while (q.length > 0) {
            const u = q.shift() as string;
            for (const v of adjacency[u] ?? []) {
                if ((dist.get(v) as number) === Infinity) {
                    dist.set(v, (dist.get(u) as number) + 1);
                    q.push(v);
                }
            }
        }
        const e = Math.max(...dist.values());
        ecc.set(s, e);
        clr();
        setN(s, "comparing");
        yield snap(`ecc[${s}] = ${e} (farthest reachable distance).`, 1, { ecc: e });
        step += 1;
    }
    const radius = Math.min(...ecc.values());
    const diameter = Math.max(...ecc.values());
    const center = labels.filter((v) => ecc.get(v) === radius);
    const periph = labels.filter((v) => ecc.get(v) === diameter);
    clr();
    for (const v of center) setN(v, "sorted");
    for (const v of periph) setN(v, "highlight");
    for (const v of labels) if (!center.includes(v) && !periph.includes(v)) setN(v, "visited");
    yield snap(
        `Radius ${radius} (center {${center.join(",")}}), diameter ${diameter} (periphery {${periph.join(",")}}).`,
        4,
        { radius, diameter },
    );
}

const module: AlgorithmModule = {
    id: "graph-center-periphery-eccentricity",
    name: "Center / Periphery (Eccentricity)",
    category: "graph",
    complexity: { time: "O(V·(V + E))", space: "O(V)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "set up one BFS per vertex over the whole graph",
        "BFS from s: ecc[s] ← the farthest reachable distance",
        "repeat for every vertex s",
        "radius ← min ecc (center); diameter ← max ecc (periphery)",
        "done: center {C} at radius 2, periphery {A,E} at diameter 4",
    ],
};

export default module;
