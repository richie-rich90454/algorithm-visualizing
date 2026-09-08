/**
 * tree-pattern-matching.ts – Rooted subtree pattern matching
 * Checks each text node as candidate root via ordered comparison.
 * Time O(n·m), Space O(n). match=comparing, found=sorted.
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
            text?: { parentMap: Record<string, string | null>; ids: string[] };
            pattern?: { parentMap: Record<string, string | null>; ids: string[] };
        } | null) ?? {};
    const text = t.text ?? { parentMap: { B: "A", C: "A", D: "B" }, ids: ["A", "B", "C", "D"] };
    const pat = t.pattern ?? { parentMap: { D: "B" }, ids: ["B", "D"] };
    const pt = new Map<string, string | null>(Object.entries(text.parentMap));
    const pp = new Map<string, string | null>(Object.entries(pat.parentMap));
    let step = 0;
    const st = new Map<string, EntityState>();
    const bedges = () => {
        const e: VisualEdge[] = [];
        for (const [c, p] of pt)
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
        entities: build(pt, text.ids, st),
        edges: bedges(),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (text.ids.length === 0 || pat.ids.length === 0) {
        yield frame("Empty text or pattern – no match.", 0, { match: "none" });
        return;
    }
    const kids = (pm: Map<string, string | null>, ids: string[]): Map<string, string[]> => {
        const k = new Map<string, string[]>();
        for (const id of ids) k.set(id, []);
        for (const [c, p] of pm) if (p && k.has(p)) k.get(p)?.push(c);
        return k;
    };
    const kt = kids(pt, text.ids);
    const kp = kids(pp, pat.ids);
    const proot = pat.ids.find((id) => !pp.get(id)) ?? pat.ids[0]!;
    const matchAt = (u: string, v: string): boolean => {
        const cu = kt.get(u) ?? [];
        const cv = kp.get(v) ?? [];
        if (cu.length < cv.length) return false;
        return cv.every((w, i) => matchAt(cu[i]!, w));
    };
    yield frame(`Match pattern [${pat.ids.join(",")}] rooted at ${proot} inside text.`, 0, {});
    step += 1;
    let found: string | null = null;
    for (const u of text.ids) {
        for (const id of text.ids) st.set(id, "idle");
        st.set(u, "comparing");
        const ok = matchAt(u, proot);
        yield frame(`Try text node ${u} as root – ${ok ? "match ✓" : "mismatch"}.`, 2, {
            candidate: u,
            ok,
        });
        step += 1;
        if (ok) {
            found = u;
            break;
        }
        st.set(u, "visited");
        if (step > 12) break;
    }
    for (const id of text.ids) st.set(id, "idle");
    if (found) st.set(found, "sorted");
    yield frame(found ? `Pattern occurs at text node ${found}.` : "Pattern does not occur.", 4, {
        match: found ?? "none",
    });
}
const module: AlgorithmModule = {
    id: "tree-pattern-matching",
    name: "Tree Pattern Matching",
    category: "tree",
    complexity: { time: "O(n·m)", space: "O(n)" },
    defaultInput: {
        text: { parentMap: { B: "A", C: "A", D: "B" }, ids: ["A", "B", "C", "D"] },
        pattern: { parentMap: { D: "B" }, ids: ["B", "D"] },
    },
    visualType: "tree",
    run,
};
export default module;
