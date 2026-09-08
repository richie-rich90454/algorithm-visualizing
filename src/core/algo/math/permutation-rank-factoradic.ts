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
 * permutation-rank-factoradic – Permutation Rank via Factoradic.
 * Counts smaller unused elements right of each slot, weights by k!.
 * Default [2,0,1] has rank 4 of 3!. Time O(n^2), space O(n).
 */
function fact(k: number): number {
    let r = 1;
    for (let i = 2; i <= k; i += 1) r *= i;
    return r;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { perm?: number[] } | null) ?? {};
    const perm = Array.isArray(t.perm) ? [...(t.perm as number[])] : [2, 0, 1];
    let step = 0;
    const n = perm.length;
    const okShape = n >= 1 && [...perm].sort((u, v) => u - v).every((v, i) => v === i);
    if (!okShape) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs a permutation of 0..n-1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: perm.map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Rank [${perm}] among ${fact(n)} orders of ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let rank = 0;
    for (let i = 0; i < n; i += 1) {
        let smaller = 0;
        for (let j = i + 1; j < n; j += 1)
            if ((perm[j] as number) < (perm[i] as number)) smaller += 1;
        const w = fact(n - 1 - i);
        rank += smaller * w;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `c=${smaller}`, smaller, "comparing"),
                C(0, 1, `w=${w}`, w, "idle"),
                C(0, 2, `r=${rank}`, rank, "highlight"),
            ],
            edges: [],
            description: `Slot ${i} (${perm[i]}): ${smaller} smaller right x ${w}!-weight ${w} – rank ${rank}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rank },
        };
        step += 1;
        if (step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `rank=${rank}`, rank, "sorted")],
        edges: [],
        description: `[${perm}] is rank ${rank} of ${fact(n)} (0-based).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rank },
    };
}
const module: AlgorithmModule = {
    id: "permutation-rank-factoradic",
    name: "Permutation Rank (Factoradic)",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { perm: [2, 0, 1] },
    visualType: "grid",
    run,
};
export default module;
