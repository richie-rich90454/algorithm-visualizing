/**
 * graph-center-periphery-eccentricity.ts – Center / Periphery (Eccentricity)
 *
 * ecc[v] = max distance to anyone; radius = min ecc (center), diameter =
 * max ecc (periphery). Path A–B–C–D–E: center C, periphery A and E.
 * Time: O(V·(V + E)) Space: O(V)
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
        2,
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
};

export default module;
