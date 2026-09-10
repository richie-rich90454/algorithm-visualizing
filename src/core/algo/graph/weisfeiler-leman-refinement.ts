/**
 * weisfeiler-leman-refinement.ts – Weisfeiler–Lehman Refinement
 *
 * 1-WL recolors each vertex by (own color, sorted neighbor colors) until
 * stable. Triangle (all deg-2) vs path (deg 1,2,1): histograms differ, so
 * the graphs are non-isomorphic.
 * Time: O(k·(V + E)) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { g1?: Record<string, string[]>; g2?: Record<string, string[]> } | null) ?? {};
    const g1: Record<string, string[]> = task.g1 ?? { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] };
    const g2: Record<string, string[]> = task.g2 ?? { X: ["Y"], Y: ["X", "Z"], Z: ["Y"] };
    const l1 = Object.keys(g1).sort();
    const l2 = Object.keys(g2).sort();
    const combo = [...l1.map((v) => `1${v}`), ...l2.map((v) => `2${v}`)];
    const nodes = makeGraphNodes(combo);
    const comboAdj: Record<string, string[]> = {};
    for (const v of l1) comboAdj[`1${v}`] = (g1[v] ?? []).map((w) => `1${w}`);
    for (const v of l2) comboAdj[`2${v}`] = (g2[v] ?? []).map((w) => `2${w}`);
    const edges = makeGraphEdges(comboAdj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (combo.length === 0) {
        yield snap("Both graphs empty – trivially indistinguishable.", 0);
        return;
    }
    let c1 = new Map(l1.map((v) => [v, (g1[v] ?? []).length]));
    let c2 = new Map(l2.map((v) => [v, (g2[v] ?? []).length]));
    yield snap("Round 0: color by degree – G1 all 2, G2 {X:1, Y:2, Z:1}.", 0, { round: 0 });
    step += 1;
    for (const v of l1) setN(`1${v}`, "sorted");
    for (const v of l2) setN(`2${v}`, c2.get(v) === 2 ? "highlight" : "visited");
    yield snap("G1 uniform (all degree 2); G2 splits hub Y from leaves X, Z.", 1, { round: 0 });
    step += 1;
    const sig = (g: Record<string, string[]>, c: Map<string, number>, v: string): string =>
        `${c.get(v)}:[${(g[v] ?? [])
            .map((w) => c.get(w))
            .sort()
            .join(",")}]`;
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing"];
    for (let r = 1; r <= 2; r += 1) {
        const ids = new Map<string, number>();
        let next = 0;
        const nc1 = new Map<string, number>();
        const nc2 = new Map<string, number>();
        for (const v of [...l1.map((x) => `1:${x}`), ...l2.map((x) => `2:${x}`)]) {
            const [tag, name] = v.split(":") as [string, string];
            const s = tag === "1" ? sig(g1, c1, name) : sig(g2, c2, name);
            if (!ids.has(s)) ids.set(s, next++);
            (tag === "1" ? nc1 : nc2).set(name, ids.get(s) as number);
        }
        c1 = nc1;
        c2 = nc2;
        for (const v of l1)
            setN(`1${v}`, palette[(c1.get(v) as number) % palette.length] as EntityState);
        for (const v of l2)
            setN(`2${v}`, palette[(c2.get(v) as number) % palette.length] as EntityState);
        const h1 = l1
            .map((v) => c1.get(v))
            .sort()
            .join(",");
        const h2 = l2
            .map((v) => c2.get(v))
            .sort()
            .join(",");
        yield snap(
            `Round ${r}: G1 histogram [${h1}] vs G2 [${h2}]${h1 === h2 ? " – still tied." : " – differ."}`,
            1,
            { round: r },
        );
        step += 1;
    }
    const h1 = l1
        .map((v) => c1.get(v))
        .sort()
        .join(",");
    const h2 = l2
        .map((v) => c2.get(v))
        .sort()
        .join(",");
    yield snap(
        h1 === h2
            ? "1-WL cannot distinguish these graphs (possibly isomorphic)."
            : "Histograms differ → the triangle and the path are non-isomorphic.",
        2,
        {
            g1: l1.map((v) => `${v}:${c1.get(v)}`),
            g2: l2.map((v) => `${v}:${c2.get(v)}`),
            distinguishable: h1 !== h2,
        },
    );
}

const module: AlgorithmModule = {
    id: "weisfeiler-leman-refinement",
    name: "Weisfeiler–Lehman Refinement",
    category: "graph",
    complexity: { time: "O(k·(V + E))", space: "O(V + E)" },
    defaultInput: {
        g1: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        g2: { X: ["Y"], Y: ["X", "Z"], Z: ["Y"] },
    },
    visualType: "graph",
    run,
};

export default module;
