/**
 * virtual-tree.ts – Virtual tree on important nodes + LCAs
 * Keeps only important nodes and their LCAs, rewiring stacked edges.
 * Time O(k log k), Space O(k). important=comparing, lca=highlight.
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
            important?: string[];
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "B", F: "C" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E", "F"];
    const imp = (t.important ?? ["D", "E", "F"]).filter((x) => ids.includes(x));
    let step = 0;
    const st = new Map<string, EntityState>();
    const virt: VisualEdge[] = [];
    const base = () => {
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
    const frame = (
        d: string,
        line: number,
        meta: VisualFrame["meta"],
        edges?: VisualEdge[],
    ): VisualFrame => ({
        stepNumber: step,
        entities: build(pm, ids, st),
        edges: edges ?? base(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0 || imp.length === 0) {
        yield frame("Empty tree or no important nodes – virtual tree is empty.", 0, {
            virtual: [],
        });
        return;
    }
    const depth = new Map<string, number>();
    const tin = new Map<string, number>();
    let timer = 0;
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    const walk = (u: string, d: number): void => {
        depth.set(u, d);
        tin.set(u, timer++);
        for (const v of kids.get(u) ?? []) walk(v, d + 1);
    };
    walk(root, 0);
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
    yield frame(`Virtual tree – important nodes: ${imp.join(", ")}.`, 0, { important: imp });
    step += 1;
    for (const x of imp) st.set(x, "comparing");
    yield frame(`Mark important nodes ${imp.join(", ")} as comparing.`, 1, { important: imp });
    step += 1;
    const aug = new Set(imp);
    const added: string[] = [];
    const sortedImp = [...imp].sort((a, b) => (tin.get(a) ?? 0) - (tin.get(b) ?? 0));
    for (let i = 0; i + 1 < sortedImp.length; i += 1) {
        const w = lca(sortedImp[i]!, sortedImp[i + 1]!);
        if (!aug.has(w)) {
            aug.add(w);
            added.push(w);
        }
    }
    for (const w of added) st.set(w, "highlight");
    yield frame(
        added.length > 0 ? `Add LCAs ${added.join(", ")} as highlight.` : "No extra LCAs needed.",
        2,
        { lcas: added },
    );
    step += 1;
    const order = [...aug].sort((a, b) => (tin.get(a) ?? 0) - (tin.get(b) ?? 0));
    yield frame(`Sort augmented set by entry time: ${order.join(" → ")}.`, 3, { order });
    step += 1;
    const stack: string[] = [];
    for (const u of order) {
        while (
            stack.length > 0 &&
            (tin.get(stack[stack.length - 1]!) ?? 0) + 99 < (tin.get(u) ?? 0) &&
            lca(stack[stack.length - 1]!, u) !== stack[stack.length - 1]
        )
            stack.pop();
        // pop while top is not an ancestor of u
        while (stack.length > 0 && lca(stack[stack.length - 1]!, u) !== stack[stack.length - 1])
            stack.pop();
        if (stack.length > 0)
            virt.push({
                id: `vedge-${stack[stack.length - 1]}-${u}`,
                sourceId: `node-${stack[stack.length - 1]}`,
                targetId: `node-${u}`,
                label: "",
                state: "idle",
                directed: false,
            });
        stack.push(u);
        yield frame(
            `Stack push ${u} – virtual edges so far: ${virt.length > 0 ? virt.map((e) => `${e.sourceId.slice(5)}→${e.targetId.slice(5)}`).join(", ") : "none"}.`,
            4,
            { stack: [...stack] },
            virt.length > 0 ? [...virt] : base(),
        );
        step += 1;
        if (step > 12) break;
    }
    for (const u of aug) st.set(u, "sorted");
    yield frame(
        `Virtual tree done – ${aug.size} nodes, ${virt.length} edges: ${virt.map((e) => `${e.sourceId.slice(5)}→${e.targetId.slice(5)}`).join(", ") || "none"}.`,
        5,
        { virtual: order, edges: virt.length },
    );
}
const module: AlgorithmModule = {
    id: "virtual-tree",
    name: "Virtual Tree",
    category: "tree",
    complexity: { time: "O(k log k)", space: "O(k)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C" },
        ids: ["A", "B", "C", "D", "E", "F"],
        important: ["D", "E", "F"],
    },
    visualType: "tree",
    run,
};
export default module;
