import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function B(i: number, label: string, value: number, state: EntityState = "idle"): VisualEntity {
    return {
        id: `bar-${i}`,
        type: "bar" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    };
}
/**
 * farey-sequence – Farey Sequence by Mediant Insertion.
 * Repeatedly inserts mediants with denominator <= order.
 * Default order 4: 0/1..1/1 (7 terms). Time O(n^2).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { order?: number } | null) ?? {};
    const order = typeof t.order === "number" ? Math.trunc(t.order) : 4;
    let step = 0;
    if (!(order >= 1) || order > 8) {
        yield {
            stepNumber: 0,
            entities: [B(0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 1 <= order <= 8).`,
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    let seq: Array<[number, number]> = [
        [0, 1],
        [1, 1],
    ];
    const bars = (hot: number, desc: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: seq.map(([a, b], i) =>
            B(i, `${a}/${b}`, a / b, i === hot ? "comparing" : "idle"),
        ),
        edges: [],
        description: desc,
        codeLineNumber: line,
        layout: "array",
        meta: {},
    });
    yield bars(-1, `Farey start: 0/1, 1/1.`, 0);
    step += 1;
    for (let pass = 0; pass < 6; pass += 1) {
        let added = false;
        const next: Array<[number, number]> = [];
        for (let i = 0; i < seq.length - 1; i += 1) {
            next.push(seq[i] as [number, number]);
            const [a, b] = seq[i] as [number, number];
            const [c, d] = seq[i + 1] as [number, number];
            if (b + d <= order) {
                next.push([a + c, b + d]);
                added = true;
            }
        }
        next.push(seq[seq.length - 1] as [number, number]);
        seq = next;
        yield {
            stepNumber: step,
            entities: seq.map(([a, b], i) => B(i, `${a}/${b}`, a / b, "comparing")),
            edges: [],
            description: `Pass ${pass + 1}: [${seq.map(([a, b]) => `${a}/${b}`).join(", ")}].`,
            codeLineNumber: 1,
            layout: "array",
            meta: {},
        };
        step += 1;
        if (!added || step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: seq.map(([a, b], i) => B(i, `${a}/${b}`, a / b, "sorted")),
        edges: [],
        description: `Farey(${order}): ${seq.length} terms.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { count: seq.length },
    };
}
const module: AlgorithmModule = {
    id: "farey-sequence",
    name: "Farey Sequence",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { order: 4 },
    visualType: "array",
    run,
};
export default module;
