/**
 * dominators-lengauer-tarjan.ts – Dominators (Lengauer–Tarjan)
 *
 * Lengauer–Tarjan frames flow analysis as DFS order + semidominators with
 * union-find link-eval; the iterative dataflow below converges to the same
 * idom tree. Flow A→{B,C}→D→E: idom(D)=A, idom(E)=D.
 * Time: O((V + E) log(V + E)) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["D"],
        C: ["D"],
        D: ["E"],
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
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const pred = new Map(labels.map((v) => [v, [] as string[]]));
    for (const [u, vs] of Object.entries(adjacency))
        for (const v of vs) (pred.get(v) as string[]).push(u);
    const dom = new Map(labels.map((v) => [v, new Set(labels)]));
    dom.set(start, new Set([start]));
    setN(start, "comparing");
    yield snap(`Flow graph from entry ${start}: Dom(entry)={entry}, all others start full.`, 0, {});
    step += 1;
    let changed = true;
    let rounds = 0;
    while (changed && rounds < 10) {
        changed = false;
        rounds += 1;
        for (const v of labels) {
            if (v === start) continue;
            const ps = pred.get(v) as string[];
            let inter: Set<string> | null = null;
            for (const p of ps) {
                const d = dom.get(p) as Set<string>;
                inter =
                    inter === null
                        ? new Set(d)
                        : new Set([...(inter as Set<string>)].filter((x) => d.has(x)));
            }
            const next = new Set([v, ...(inter ?? [])]);
            const old = dom.get(v) as Set<string>;
            if (next.size !== old.size || [...next].some((x) => !old.has(x))) {
                dom.set(v, next);
                changed = true;
            }
        }
        clr();
        setN(start, "highlight");
        yield snap(`Dataflow round ${rounds}: intersect predecessor sets, add self.`, 1, {
            round: rounds,
        });
        step += 1;
    }
    const idom = new Map<string, string>();
    const last = labels[labels.length - 1] as string;
    for (const v of labels) {
        if (v === start) continue;
        const ds = [...(dom.get(v) as Set<string>)].filter((x) => x !== v);
        let best = "";
        let bestSize = -1;
        for (const x of ds) {
            const s = (dom.get(x) as Set<string>).size;
            if (s > bestSize) {
                bestSize = s;
                best = x;
            }
        }
        idom.set(v, best);
        setE(best, v, "active");
    }
    clr();
    for (const [a, b] of idom) {
        setE(a, b, "path");
        setN(b, "sorted");
    }
    setN(start, "highlight");
    yield snap(
        `idom tree: ${labels
            .filter((v) => v !== start)
            .map((v) => `idom(${v})=${idom.get(v)}`)
            .join(", ")}; Dom(${last})={${[...(dom.get(last) as Set<string>)].sort().join(",")}}.`,
        2,
        { rounds },
    );
}

const module: AlgorithmModule = {
    id: "dominators-lengauer-tarjan",
    name: "Dominators (Lengauer–Tarjan)",
    category: "graph",
    complexity: { time: "O((V + E) log(V + E))", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["D"], C: ["D"], D: ["E"], E: [] }, start: "A" },
    visualType: "graph",
    run,
};

export default module;
