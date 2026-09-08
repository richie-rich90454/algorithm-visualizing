/**
 * freivalds-check.ts – Freivalds' Matrix-Product Check.
 * Verifies A·B=C by testing A(Br)=Cr on random 0/1 vectors r: a wrong
 * product is caught with probability ≥ 1/2 per trial, 1-(1/2)^k overall.
 * Fixed-seed LCG keeps the demo deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

const matVec = (m: number[][], v: number[]): number[] =>
    m.map((row) => row.reduce((s, a, j) => s + a * (v[j] ?? 0), 0));

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { trials?: number; seed?: number } | null) ?? {};
    const trials = Math.max(1, Math.min(6, cfg.trials ?? 3));
    const rnd = lcg(cfg.seed ?? 5);
    const A = [
        [1, 2],
        [3, 4],
    ];
    const B = [
        [5, 6],
        [7, 8],
    ];
    const C = [
        [19, 22],
        [43, 50],
    ];
    let step = 0;
    const frame = (r: number[], diff: number[], t: number, desc: string): VisualFrame => {
        const vals = [...r, ...diff];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `v-${i}`,
            type: "cell" as const,
            label: i < r.length ? `r${i}=${v}` : `d${i - r.length}=${v}`,
            value: v,
            state: (i >= r.length ? (v === 0 ? "sorted" : "error") : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i < r.length ? 0 : 1, col: i < r.length ? i : i - r.length },
        }));
        const match = diff.every((d) => d === 0);
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: t,
            layout: "grid",
            meta: { trial: t, match },
        };
    };
    yield frame([0, 0], [0, 0], 0, "Claim: A·B=C for 2×2 matrices; each trial tests A(Br) vs Cr.");
    step += 1;
    let allMatch = true;
    for (let t = 1; t <= trials; t += 1) {
        const r = [rnd() < 0.5 ? 0 : 1, rnd() < 0.5 ? 0 : 1];
        const br = matVec(B, r);
        const abr = matVec(A, br);
        const cr = matVec(C, r);
        const diff = abr.map((v, i) => v - (cr[i] ?? 0));
        if (!diff.every((d) => d === 0)) allMatch = false;
        yield frame(
            r,
            diff,
            t,
            `Trial ${t}: r=[${r}] → A(Br)-Cr=[${diff}] ${diff.every((d) => d === 0) ? "matches" : "MISMATCH"}.`,
        );
        step += 1;
    }
    yield frame(
        [0, 0],
        [0, 0],
        trials + 1,
        allMatch
            ? `Verdict: C=A·B (probably equal; error ≤ 1/2^${trials}).`
            : "Verdict: C≠A·B (mismatch found).",
    );
}

const module: AlgorithmModule = {
    id: "freivalds-check",
    name: "Freivalds' Check",
    category: "math",
    complexity: { time: "O(k·n²)", space: "O(n)" },
    defaultInput: { trials: 3, seed: 5 },
    visualType: "grid",
    run,
};

export default module;
