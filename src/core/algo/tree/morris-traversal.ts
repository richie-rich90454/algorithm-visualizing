/**
 * morris-traversal.ts – Morris inorder (threaded, O(1) space)
 * Temporarily threads predecessor→current, then restores links.
 * Time O(n), Space O(1). current=comparing, done=sorted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            left?: Record<string, string | null>;
            right?: Record<string, string | null>;
        } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { B: "A", C: "A", D: "B", E: "C" }),
    );
    const ids = t.ids ?? ["A", "B", "C", "D", "E"];
    const left: Record<string, string | null> = t.left ?? {
        A: "B",
        B: "D",
        C: "E",
        D: null,
        E: null,
    };
    const right: Record<string, string | null> = t.right ?? {
        A: "C",
        B: null,
        C: null,
        D: null,
        E: null,
    };
    let step = 0;
    const st = new Map<string, EntityState>();
    const snap = (): VisualEntity[] =>
        ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: 0,
            state: st.get(id) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: pm.get(id) ?? "root" },
        }));
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
        entities: snap(),
        edges: bedges(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – inorder is [].", 0, { inorder: [] });
        return;
    }
    const root = ids.find((id) => !pm.get(id)) ?? ids[0]!;
    const L = new Map<string, string | null>(Object.entries(left));
    const R = new Map<string, string | null>(Object.entries(right));
    yield frame(`Morris inorder from root ${root} with O(1) extra space.`, 0, {});
    step += 1;
    const order: string[] = [];
    let cur: string | null = root;
    const thread = new Map<string, string | null>();
    let guard = 0;
    while (cur && guard++ < 50) {
        const lc: string | null = L.get(cur) ?? null;
        if (!lc) {
            order.push(cur);
            st.set(cur, "comparing");
            yield frame(`Visit ${cur} (no left) – inorder [${order.join(",")}].`, 1, {
                inorder: [...order],
            });
            step += 1;
            st.set(cur, "sorted");
            cur = (thread.get(cur) ?? R.get(cur)) || null;
        } else {
            let p: string = lc;
            while ((R.get(p) ?? thread.get(p)) && (R.get(p) ?? thread.get(p)) !== cur)
                p = (R.get(p) ?? thread.get(p))!;
            const link = R.get(p) ?? thread.get(p) ?? null;
            if (!link) {
                thread.set(p, cur);
                st.set(cur, "comparing");
                yield frame(`Thread ${p}→${cur}; go left to ${lc}.`, 2, { inorder: [...order] });
                step += 1;
                st.set(cur, "idle");
                cur = lc;
            } else {
                thread.delete(p);
                order.push(cur);
                st.set(cur, "comparing");
                yield frame(`Thread ${p}→${cur} removed; visit ${cur} – [${order.join(",")}].`, 3, {
                    inorder: [...order],
                });
                step += 1;
                st.set(cur, "sorted");
                cur = (thread.get(cur) ?? R.get(cur)) || null;
            }
        }
        if (step > 12) break;
    }
    for (const id of ids) st.set(id, "sorted");
    yield frame(
        `Morris inorder complete [${order.join(",")}]; all ${order.length} nodes visited.`,
        4,
        { inorder: order },
    );
}
const module: AlgorithmModule = {
    id: "morris-traversal",
    name: "Morris Traversal",
    category: "tree",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "C" },
        ids: ["A", "B", "C", "D", "E"],
        left: { A: "B", B: "D", C: "E", D: null, E: null },
        right: { A: "C", B: null, C: null, D: null, E: null },
    },
    visualType: "tree",
    run,
};
export default module;
