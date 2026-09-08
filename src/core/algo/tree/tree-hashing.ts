/**
 * tree-hashing.ts – Subtree hashing (sorted child-hash combine)
 * hash(u) = 1 + sorted child hashes mixed with a prime.
 * Time O(n log deg), Space O(n). current=comparing, done=sorted.
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
    const t = (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "B" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
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
        yield frame("Empty tree – hash is 0.", 0, { hash: 0 });
        return;
    }
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of pm) if (p && kids.has(p)) kids.get(p)?.push(c);
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    const post: string[] = [];
    const dfs = (u: string): void => {
        for (const v of kids.get(u) ?? []) dfs(v);
        post.push(u);
    };
    dfs(root);
    yield frame(`Subtree hashing – postorder ${post.join(" → ")}.`, 0, {});
    step += 1;
    const H = new Map<string, number>();
    const mix = (xs: number[]): number => {
        let h = 7;
        for (const x of xs) h = (h * 31 + x) % 1000003;
        return (h * 31 + 17) % 1000003;
    };
    for (const u of post) {
        const ch = (kids.get(u) ?? []).map((v) => H.get(v)!).sort((a, b) => a - b);
        const h = ch.length === 0 ? 11 : mix(ch);
        H.set(u, h);
        st.set(u, "comparing");
        yield frame(`hash(${u})=${h} from children [${ch.join(", ") || "leaf"}].`, 2, {
            node: u,
            hash: h,
        });
        step += 1;
        st.set(u, "sorted");
        if (step > 12) break;
    }
    for (const id of ids) st.set(id, "sorted");
    yield frame(`Root hash is ${H.get(root)}; equal hashes mean isomorphic subtrees here.`, 4, {
        hash: H.get(root) ?? 0,
        hashes: [...H].map(([k, v]) => `${k}=${v}`),
    });
}
const module: AlgorithmModule = {
    id: "tree-hashing",
    name: "Tree Hashing",
    category: "tree",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { parentMap: { B: "A", C: "A", D: "B", E: "B" }, ids: ["A", "B", "C", "D", "E"] },
    visualType: "tree",
    run,
};
export default module;
