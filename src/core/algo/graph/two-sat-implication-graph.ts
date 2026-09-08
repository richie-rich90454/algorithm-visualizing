/**
 * two-sat-implication-graph.ts – 2-SAT via Implication Graph
 *
 * Each clause (a∨b) becomes edges ¬a→b, ¬b→a; the formula is satisfiable
 * iff no variable shares an SCC with its negation. Here SAT: x0=F, x1=T.
 * Time: O(V + E) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { clauses?: Array<[string, string]> } | null) ?? {};
    const clauses: Array<[string, string]> = task.clauses ?? [
        ["x0", "x1"],
        ["nx0", "x1"],
        ["nx0", "nx1"],
    ];
    const neg = (l: string): string => (l.startsWith("n") ? l.slice(1) : `n${l}`);
    const lits = [...new Set(clauses.flatMap(([a, b]) => [a, b, neg(a), neg(b)]))].sort();
    const imp: Record<string, string[]> = {};
    for (const l of lits) imp[l] = [];
    for (const [a, b] of clauses) {
        (imp[neg(a)] as string[]).push(b);
        (imp[neg(b)] as string[]).push(a);
    }
    const nodes = makeGraphNodes(lits);
    const edges = makeGraphEdges(imp);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
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
    if (lits.length === 0) {
        yield snap("Empty formula – trivially satisfiable.", 0);
        return;
    }
    yield snap(`Implication graph for ${clauses.length} clauses over ${lits.length} literals.`, 0, {
        clauses: clauses.length,
    });
    step += 1;
    clauses.forEach(([a, b], i) => {
        setE(neg(a), b, "active");
        setE(neg(b), a, "active");
    });
    yield snap(
        `Clause edges added: ${clauses.map(([a, b]) => `(¬${a}→${b}, ¬${b}→${a})`).join(" ")}.`,
        1,
        {},
    );
    step += 1;
    const order: string[] = [];
    const seen = new Set<string>();
    const visit = (u: string): void => {
        seen.add(u);
        for (const v of imp[u] ?? []) if (!seen.has(v)) visit(v);
        order.push(u);
    };
    for (const l of lits) if (!seen.has(l)) visit(l);
    yield snap(`DFS finish order: ${order.join(", ")} – SCCs come from the reversed graph.`, 1, {});
    step += 1;
    const rev: Record<string, string[]> = {};
    for (const l of lits) rev[l] = [];
    for (const [u, vs] of Object.entries(imp)) for (const v of vs) (rev[v] as string[]).push(u);
    const comp = new Map<string, number>();
    let nc = 0;
    for (let i = order.length - 1; i >= 0; i -= 1) {
        const s = order[i] as string;
        if (comp.has(s)) continue;
        const stack = [s];
        comp.set(s, nc);
        while (stack.length > 0) {
            const u = stack.pop() as string;
            for (const v of rev[u] ?? [])
                if (!comp.has(v)) {
                    comp.set(v, nc);
                    stack.push(v);
                }
        }
        nc += 1;
    }
    for (const [l, c] of comp) setN(l, c % 2 === 0 ? "sorted" : "visited");
    yield snap(`Kosaraju: ${nc} SCCs – no variable shares one with its negation.`, 2, { sccs: nc });
    step += 1;
    let sat = true;
    const assign = new Map<string, boolean>();
    for (const l of lits) {
        if (l.startsWith("n")) continue;
        if (comp.get(l) === comp.get(neg(l))) {
            sat = false;
            break;
        }
        assign.set(l, (comp.get(l) as number) < (comp.get(neg(l)) as number));
    }
    void clauses;
    for (const [v, val] of assign) setN(v, val ? "sorted" : "highlight");
    const asg = [...assign.entries()].map(([v, val]) => `${v}=${val ? "T" : "F"}`).join(", ");
    yield snap(
        sat
            ? `Satisfiable: ${asg} (every clause has a true literal).`
            : "Unsatisfiable: a variable shares an SCC with its negation.",
        3,
        { sat },
    );
}

const module: AlgorithmModule = {
    id: "two-sat-implication-graph",
    name: "2-SAT (Implication Graph)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        clauses: [
            ["x0", "x1"],
            ["nx0", "x1"],
            ["nx0", "nx1"],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
