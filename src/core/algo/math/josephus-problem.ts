import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * josephus-problem – Josephus Survivor.
 * Removes every k-th person; recurrence J(n) = (J(n-1)+k) mod n.
 * Default n=7, k=3 gives survivor 4 (1-based). Time O(n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; k?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 7;
    const k = typeof t.k === "number" ? Math.trunc(t.k) : 3;
    let step = 0;
    if (!(n >= 1) || !(k >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n,k >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    let alive = Array.from({ length: n }, (_, i) => i + 1);
    yield {
        stepNumber: step,
        entities: alive.map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Circle of ${n}, step k=${k}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let idx = 0;
    while (alive.length > 1) {
        idx = (idx + k - 1) % alive.length;
        const out = alive.splice(idx, 1)[0] as number;
        if (alive.length >= n - 3 || alive.length === 1) {
            yield {
                stepNumber: step,
                entities: alive.map((v, i) =>
                    C(0, i, `${v}`, v, i === idx % alive.length ? "comparing" : "idle"),
                ),
                edges: [],
                description: `Remove ${out}; ${alive.length} remain [${alive}].`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { out },
            };
            step += 1;
        }
        if (step > 12) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${alive[0]}`, alive[0] as number, "sorted")],
        edges: [],
        description: `Survivor is ${alive[0]}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { survivor: alive[0] },
    };
}
const module: AlgorithmModule = {
    id: "josephus-problem",
    name: "Josephus Problem",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 7, k: 3 },
    visualType: "grid",
    run,
};
export default module;
