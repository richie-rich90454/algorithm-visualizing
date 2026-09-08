/**
 * tree-edit-distance.ts – Ordered tree edit on root-to-leaf paths
 * Default trees are chains, so Levenshtein on label paths is exact.
 * Time O(n·m), Space O(n·m). current row=comparing, done=sorted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function chain(parent: Map<string, string | null>, ids: string[]): string[] {
    const out: string[] = [];
    let r = ids.find((id) => !parent.get(id)) ?? ids[0]!;
    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [c, p] of parent) if (p && kids.has(p)) kids.get(p)?.push(c);
    let u: string | undefined = r;
    while (u) {
        out.push(u);
        u = (kids.get(u) ?? [])[0];
    }
    return out;
}
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
            t1?: { parentMap: Record<string, string | null>; ids: string[] };
            t2?: { parentMap: Record<string, string | null>; ids: string[] };
        } | null) ?? {};
    const t1 = t.t1 ?? { parentMap: { B: "A", C: "B" }, ids: ["A", "B", "C"] };
    const t2 = t.t2 ?? { parentMap: { Y: "X", Z: "Y" }, ids: ["X", "Y", "Z"] };
    const p1 = new Map<string, string | null>(Object.entries(t1.parentMap));
    const p2 = new Map<string, string | null>(Object.entries(t2.parentMap));
    let step = 0;
    const st = new Map<string, EntityState>();
    const bedges = (pm: Map<string, string | null>) => {
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
    const frame = (d: string, meta: VisualFrame["meta"], which: string[]): VisualFrame => ({
        stepNumber: step,
        entities: build(p1, t1.ids, st),
        edges: bedges(p1),
        description: d,
        codeLineNumber: 2,
        layout: "tree",
        meta: { ...meta, path2: which },
    });
    if (t1.ids.length === 0 && t2.ids.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Both trees empty – distance is 0.",
            codeLineNumber: 0,
            layout: "tree",
            meta: { distance: 0 },
        };
        return;
    }
    const a = chain(p1, t1.ids.length > 0 ? t1.ids : ["A"]);
    const b = chain(p2, t2.ids.length > 0 ? t2.ids : ["X"]);
    const A = t1.ids.length > 0 ? a : [];
    const B = t2.ids.length > 0 ? b : [];
    yield frame(
        `Edit distance between paths [${A.join("→") || "∅"}] and [${B.join("→") || "∅"}].`,
        {},
        B,
    );
    step += 1;
    const dp: number[][] = Array.from({ length: A.length + 1 }, (_, i) =>
        Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= A.length; i += 1) {
        for (const id of t1.ids) st.set(id, "idle");
        if (A[i - 1]) st.set(A[i - 1]!, "comparing");
        for (let j = 1; j <= B.length; j += 1)
            dp[i]![j] = Math.min(
                dp[i - 1]![j]! + 1,
                dp[i]![j - 1]! + 1,
                dp[i - 1]![j - 1]! + (A[i - 1] === B[j - 1] ? 0 : 1),
            );
        yield frame(`Row ${i} (${A[i - 1]}): dp=[${dp[i]!.join(",")}].`, { row: i }, B);
        step += 1;
        if (A[i - 1]) st.set(A[i - 1]!, "sorted");
        if (step > 12) break;
    }
    const ans = dp[A.length]![B.length]!;
    for (const id of t1.ids) st.set(id, "sorted");
    yield frame(
        `Tree edit distance is ${ans} (rename cost 1, insert/delete 1).`,
        { distance: ans },
        B,
    );
}
const module: AlgorithmModule = {
    id: "tree-edit-distance",
    name: "Tree Edit Distance",
    category: "tree",
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    defaultInput: {
        t1: { parentMap: { B: "A", C: "B" }, ids: ["A", "B", "C"] },
        t2: { parentMap: { Y: "X", Z: "Y" }, ids: ["X", "Y", "Z"] },
    },
    visualType: "tree",
    run,
};
export default module;
