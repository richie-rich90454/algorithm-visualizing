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
 * bertrand-postulate-check – Bertrand's Postulate Check.
 * Finds a prime p with n < p < 2n by trial division scan.
 * Default n=10 witnesses p=11. Time O(n sqrt(n)).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 10;
    let step = 0;
    if (!(n >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const isPrime = (v: number): boolean => {
        if (v < 2) return false;
        for (let d = 2; d * d <= v; d += 1) if (v - Math.trunc(v / d) * d === 0) return false;
        return true;
    };
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `2n=${2 * n}`, 2 * n, "idle")],
        edges: [],
        description: `Seek prime p with ${n} < p < ${2 * n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const cands: number[] = [];
    for (let v = n + 1; v < 2 * n; v += 1) cands.push(v);
    yield {
        stepNumber: step,
        entities: cands.slice(0, 9).map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Candidates ${n + 1}..${2 * n - 1}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const w = cands.find(isPrime) as number;
    for (const d of [2, 3]) {
        const r = w - Math.trunc(w / d) * d;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `w=${w}`, w, "comparing"), C(0, 1, `d=${d}`, d, "idle")],
            edges: [],
            description: `${w} mod ${d} = ${r} – not divisible.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${w}`, w, "sorted")],
        edges: [],
        description: `Witness p=${w}: ${n} < ${w} < ${2 * n} – postulate holds.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { witness: w },
    };
}
const module: AlgorithmModule = {
    id: "bertrand-postulate-check",
    name: "Bertrand Postulate Check",
    category: "math",
    complexity: { time: "O(n sqrt(n))", space: "O(1)" },
    defaultInput: { n: 10 },
    visualType: "grid",
    run,
};
export default module;
