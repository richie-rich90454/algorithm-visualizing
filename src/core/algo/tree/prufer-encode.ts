/**
 * prufer-encode.ts – Prüfer code from a labeled tree
 * Repeatedly strips the smallest leaf, recording its neighbor.
 * Time O(n²) demo, Space O(n). leaf=comparing, done=sorted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const pm = new Map<string, string | null>(
        Object.entries(t.parentMap ?? { "2": "1", "3": "1", "4": "3" }),
    );
    const ids = t.ids ?? ["1", "2", "3", "4"];
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
    const bedges = (alive: Set<string>) => {
        const e: VisualEdge[] = [];
        for (const [c, p] of pm)
            if (p && alive.has(c) && alive.has(p))
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
        alive: Set<string>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: snap(),
        edges: bedges(alive),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (ids.length === 0) {
        yield frame("Empty tree – code is [].", 0, { code: [] }, new Set());
        return;
    }
    if (ids.length <= 2) {
        for (const id of ids) st.set(id, "sorted");
        yield frame("Tree with ≤2 nodes – Prüfer code is [].", 0, { code: [] }, new Set(ids));
        return;
    }
    const adj = new Map<string, Set<string>>();
    for (const id of ids) adj.set(id, new Set());
    for (const [c, p] of pm)
        if (p) {
            adj.get(c)!.add(p);
            adj.get(p)!.add(c);
        }
    const alive = new Set(ids);
    const code: string[] = [];
    yield frame(
        `Encode tree [${ids.join(",")}]; strip smallest leaf ${ids.length - 2} times.`,
        0,
        { code: [] },
        alive,
    );
    step += 1;
    for (let k = 0; k < ids.length - 2; k += 1) {
        const leaf = [...alive].sort().find((v) => adj.get(v)!.size === 1)!;
        const nb = [...adj.get(leaf)!][0]!;
        code.push(nb);
        for (const id of ids) st.set(id, alive.has(id) ? "idle" : "visited");
        st.set(leaf, "comparing");
        yield frame(
            `Step ${k + 1}: leaf ${leaf} → record neighbor ${nb}; code=[${code.join(",")}].`,
            2,
            { code: [...code] },
            alive,
        );
        step += 1;
        adj.get(nb)!.delete(leaf);
        adj.get(leaf)!.clear();
        alive.delete(leaf);
        st.set(leaf, "visited");
        if (step > 12) break;
    }
    for (const id of alive) st.set(id, "sorted");
    yield frame(`Prüfer code is [${code.join(",")}].`, 4, { code }, alive);
}
const module: AlgorithmModule = {
    id: "prufer-encode",
    name: "Prüfer Encode",
    category: "tree",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: { parentMap: { "2": "1", "3": "1", "4": "3" }, ids: ["1", "2", "3", "4"] },
    visualType: "tree",
    run,
};
export default module;
