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
            codeLineNumber: Math.min(t, 6),
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

    education: {
        "intuition": "Freivalds' algorithm checks a claimed matrix product far faster than recomputing it. Instead of multiplying A and B, pick a random 0/1 vector r and test whether A(Br) equals Cr. If the product is wrong, a random r exposes the error with probability at least one half; repeating k independent trials drives the chance of missing it down to 2^-k.",
        "invariants": [
            "A correct product passes every trial: AB=C implies A(Br)=Cr for all r.",
            "A wrong product fails precisely those trials whose r lies outside a certain proper subspace.",
            "Each trial uses an independent random 0/1 vector."
        ],
        "correctness": "If AB differs from C, then D=AB-C is a nonzero matrix with a nonzero row, so the set of vectors r with Dr=0 is a proper subspace containing at most half of all 0/1 vectors. A random r therefore catches the error with probability at least 1/2, and k independent trials give error probability at most 2^-k. A correct product is never rejected.",
        "complexityRationale": "Each trial computes two matrix-vector products, O(n^2) each, so k trials cost O(k·n^2), much better than the O(n^3) of direct multiplication when k is small. Storing one vector and the intermediate results uses O(n) space.",
        "uses": [
            "Verifying large matrix products in scientific computing",
            "Checking linear-algebra kernels and numerical libraries",
            "Validating outsourced or distributed computations",
            "Randomized verification of polynomial identities"
        ],
        "references": [
            "Freivalds, Fast Probabilistic Algorithms for Verification of Polynomial Identities, 1977",
            "Motwani and Raghavan, Randomized Algorithms, Chapter 7"
        ],
        "workedExample": "For A=[[1,2],[3,4]], B=[[5,6],[7,8]] and claimed C=[[19,22],[43,50]], take r=[1,0]. Then Br=[5,7], A(Br)=[19,43] and Cr=[19,43], a match. A wrong C would fail on about half of the four possible 0/1 vectors, so three trials leave at most a 1/8 chance of a false verdict."
    },
    id: "freivalds-check",
    name: "Freivalds' Check",
    category: "math",
    complexity: { time: "O(k·n²)", space: "O(n)" },
    defaultInput: { trials: 3, seed: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize matrices A, B, and claimed product C",
        "for trial t <- 1 to trials",
        "pick random binary vector r",
        "compute A(Br) and Cr by matrix-vector products",
        "if results differ then product is wrong",
        "repeat to drive error below 1/2^k",
        "done: verdict probably equal or definitely wrong",
    ],
};

export default module;
