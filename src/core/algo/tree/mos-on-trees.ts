/**
 * mos-on-trees.ts – Mo's algorithm on trees (Euler tour + queries)
 * Flattens tree, sorts path queries into Mo order, answers distinctly.
 * Time O((n+q)√n), Space O(n). query nodes=comparing, lca=highlight.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function build(
    parent: Map<string, string | null>,
    ids: string[],
    st: Map<string, EntityState>,
): VisualEntity[] {
    return ids.map((id) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: 0,
        state: st.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent.get(id) ?? "root" },
    }));
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            values?: Record<string, number>;
            queries?: [string, string][];
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "C" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
    const values: Record<string, number> = t.values ?? { A: 1, B: 2, C: 1, D: 3, E: 2 };
    const queries: [string, string][] = t.queries ?? [
        ["D", "E"],
        ["B", "C"],
    ];
    let step = 0;
    const st = new Map<string, EntityState>();
    const bedges = () => {
        const e: VisualEdge[] = [];
        for (const [c, p] of pm)
            if (p)
                e.push({
                    id: `edge-${p}-${c}`,
                    sourceId: `node-${p}`,
                    targetId: `node-${c}`,
                    state: "idle",
                    label: "",
                    directed: false,
                });
        return e;
    };
    const frame = (d: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: build(pm, ids, st),
        edges: bedges(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – no queries to answer.", 0, { answers: [] });
        return;
    }
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    const tin = new Map<string, number>();
    const euler: string[] = [];
    const walk = (u: string): void => {
        tin.set(u, euler.length);
        euler.push(u);
        for (const v of kids.get(u) ?? []) walk(v);
    };
    walk(root);
    const depth = new Map<string, number>([[root, 0]]);
    const order: string[] = [root];
    const q2: string[] = [root];
    while (q2.length > 0) {
        const u = q2.shift()!;
        for (const v of kids.get(u) ?? []) {
            depth.set(v, (depth.get(u) ?? 0) + 1);
            q2.push(v);
            order.push(v);
        }
    }
    const lca = (a: string, b: string): string => {
        let x = a,
            y = b;
        while ((depth.get(x) ?? 0) > (depth.get(y) ?? 0)) x = pm.get(x) ?? root;
        while ((depth.get(y) ?? 0) > (depth.get(x) ?? 0)) y = pm.get(y) ?? root;
        while (x !== y) {
            x = pm.get(x) ?? root;
            y = pm.get(y) ?? root;
        }
        return x;
    };
    const pathNodes = (a: string, b: string): string[] => {
        const w = lca(a, b);
        const up: string[] = [];
        let x: string | null = a;
        while (x && x !== w) {
            up.push(x);
            x = pm.get(x) ?? null;
        }
        const down: string[] = [];
        let y: string | null = b;
        while (y && y !== w) {
            down.unshift(y);
            y = pm.get(y) ?? null;
        }
        return [...up, w, ...down];
    };
    yield frame(`Euler tour [${euler.join(", ")}]; ${queries.length} path queries queued.`, 0, {
        euler,
    });
    step += 1;
    const block = Math.max(1, Math.floor(Math.sqrt(euler.length)));
    const qord = queries
        .map((q, i) => ({ q, i, l: tin.get(q[0]) ?? 0, r: tin.get(q[1]) ?? 0 }))
        .sort((a, b) => Math.floor(a.l / block) - Math.floor(b.l / block) || a.r - b.r);
    yield frame(
        `Mo order (block=${block}): ${qord.map((o) => `Q${o.i}(${o.q[0]},${o.q[1]})`).join(" → ")}.`,
        1,
        { block },
    );
    step += 1;
    const answers: number[] = new Array(queries.length).fill(0);
    for (const o of qord) {
        for (const id of ids) st.set(id, "idle");
        const path = pathNodes(o.q[0], o.q[1]);
        const w = lca(o.q[0], o.q[1]);
        for (const x of path) st.set(x, "comparing");
        st.set(w, "highlight");
        const distinct = new Set(path.map((x) => values[x] ?? 0)).size;
        answers[o.i] = distinct;
        yield frame(
            `Q${o.i} path ${o.q[0]}→${o.q[1]} via LCA ${w}: nodes [${path.join(", ")}] distinct=${distinct}.`,
            2,
            { query: o.i, distinct },
        );
        step += 1;
        for (const x of path) st.set(x, "sorted");
    }
    for (const id of ids) st.set(id, "sorted");
    yield frame(`All queries answered – distinct counts [${answers.join(", ")}].`, 3, { answers });
}
const module: AlgorithmModule = {
    id: "mos-on-trees",
    name: "Mo's on Trees",
    category: "tree",
    complexity: { time: "O((n+q)√n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "C" },
        ids: ["A", "B", "C", "D", "E"],
        values: { A: 1, B: 2, C: 1, D: 3, E: 2 },
        queries: [
            ["D", "E"],
            ["B", "C"],
        ],
    },
    visualType: "tree",
    run,
};
export default module;
