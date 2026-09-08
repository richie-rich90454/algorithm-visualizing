/**
 * prufer-decode.ts – Tree from a Prüfer code
 * Smallest missing label joins the next code entry, iteratively.
 * Time O(n²) demo, Space O(n). placed=sorted, active=comparing.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { code?: string[]; labels?: string[] } | null) ?? {};
    const code: string[] = t.code ?? ["1", "3"];
    const labels: string[] = t.labels ?? ["1", "2", "3", "4"];
    let step = 0;
    const parent = new Map<string, string | null>();
    const st = new Map<string, EntityState>();
    const snap = (): VisualEntity[] =>
        labels.map((id) => ({
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
    const vedges: VisualEdge[] = [];
    const frame = (d: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: snap(),
        edges: vedges.map((e) => ({ ...e })),
        description: d,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });
    if (labels.length === 0) {
        yield frame("Empty labels – no tree.", 0, { edges: [] });
        return;
    }
    for (const id of labels) parent.set(id, null);
    const degree = new Map<string, number>();
    for (const id of labels) degree.set(id, 1);
    for (const c of code) degree.set(c, (degree.get(c) ?? 1) + 1);
    yield frame(`Decode code [${code.join(",") || "∅"}] on labels [${labels.join(",")}].`, 0, {
        code: [...code],
    });
    step += 1;
    const pending = [...code];
    const missing = (): string =>
        [...labels].sort().find((v) => (degree.get(v) ?? 0) === 1 && !st.has(v + ":used")) ??
        [...labels].sort().find((v) => (degree.get(v) ?? 0) === 1)!;
    void missing;
    const used = new Set<string>();
    while (pending.length > 0) {
        const leaf =
            [...labels].sort().find((v) => !used.has(v) && ![...pending].includes(v)) ??
            [...labels].sort().find((v) => !used.has(v))!;
        const nb = pending.shift()!;
        used.add(leaf);
        degree.set(leaf, 0);
        degree.set(nb, (degree.get(nb) ?? 1) - 1);
        parent.set(leaf, nb);
        vedges.push({
            id: `edge-${nb}-${leaf}`,
            sourceId: `node-${nb}`,
            targetId: `node-${leaf}`,
            state: "idle",
            label: "",
            directed: false,
        });
        for (const id of labels) if (!st.has(id)) st.set(id, "idle");
        st.set(leaf, "comparing");
        yield frame(`Join leaf ${leaf} – ${nb}; remaining code [${pending.join(",") || "∅"}].`, 2, {
            leaf,
            neighbor: nb,
        });
        step += 1;
        st.set(leaf, "sorted");
        if (step > 12) break;
    }
    const rest = labels.filter((v) => !used.has(v));
    if (rest.length === 2) {
        const [a, b] = rest.sort() as [string, string];
        parent.set(a, b);
        vedges.push({
            id: `edge-${b}-${a}`,
            sourceId: `node-${b}`,
            targetId: `node-${a}`,
            state: "idle",
            label: "",
            directed: false,
        });
        st.set(a, "sorted");
        st.set(b, "sorted");
        yield frame(`Join final pair ${a} – ${b}.`, 3, { pair: [a, b] });
        step += 1;
    }
    for (const id of labels) st.set(id, "sorted");
    yield frame(
        `Decoded ${vedges.length} edges: ${vedges.map((e) => `${e.sourceId.slice(5)}–${e.targetId.slice(5)}`).join(", ")}.`,
        4,
        { edges: vedges.length },
    );
}
const module: AlgorithmModule = {
    id: "prufer-decode",
    name: "Prüfer Decode",
    category: "tree",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: { code: ["1", "3"], labels: ["1", "2", "3", "4"] },
    visualType: "tree",
    run,
};
export default module;
