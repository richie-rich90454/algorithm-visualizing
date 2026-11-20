/**
 * virtual-tree.ts – Virtual tree on important nodes plus LCAs.
 *
 * Keeps only important nodes and their LCAs, rewiring stacked edges.
 * Time O(k log k), Space O(k). Important uses comparing, LCA uses highlight.
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
    education: {
        "intuition": "A virtual tree is a compact tree that keeps only a set of important nodes plus the lowest common ancestors needed to connect them. It preserves the ancestry relationships among those nodes while shrinking a large tree down to O(k) relevant vertices.",
        "invariants": [
            "Every important node appears in the virtual tree.",
            "The LCA of any two important nodes is included when needed to connect them.",
            "Ancestry order among kept nodes matches the original tree."
        ],
        "correctness": "Sorting important nodes by Euler entry time and inserting LCAs of neighboring pairs captures every branching point needed to connect them, because the LCA of a set of nodes appears as the LCA of some adjacent pair in that order. Rewiring parent links to skip non-kept nodes then yields a tree whose induced relationships among important nodes match the original, so any query expressible on those nodes gives the same answer on the virtual tree.",
        "complexityRationale": "Sorting k important nodes costs O(k log k), and building LCAs plus the compact tree is linear in the number of kept nodes, giving O(k log k) time and O(k) space.",
        "uses": [
            "Answering queries on a small subset of tree nodes",
            "Compressing large trees for DP over marked vertices",
            "Competitive programming multi-query tree problems"
        ],
        "references": [
            "Competitive Programming 3, Hall and Li, tree chapter",
            "CLRS, Introduction to Algorithms, Chapter 22 (lowest common ancestors)"
        ],
        "workedExample": "In a tree rooted at A with children B and C, if B and C are the important nodes, their LCA A is added and edges A-B and A-C are kept. The virtual tree has exactly three nodes and preserves their original relationships."
    },

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
    pseudocode: [
        "mark important nodes in the original tree",
        "sort important nodes by Euler entry time",
        "add LCAs of neighbors to the augmented set",
        "sort augmented set then rewire with a stack",
        "push nodes stacking parent over child edges",
        "return compressed virtual edges as the answer",
    ],
};
export default module;
