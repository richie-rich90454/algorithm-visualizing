/**
 * gibbs-sampling.ts – Gibbs Sampling.
 * Samples binary (X,Y) by alternating conditionals P(X|Y) and P(Y|X):
 * P(X=1|Y)=0.3+0.5Y, P(Y=1|X)=0.4+0.3X. Empirical marginals converge
 * to the joint's true marginals. Fixed-seed LCG keeps it deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { sweeps?: number; seed?: number } | null) ?? {};
    const sweeps = Math.max(1, Math.min(12, cfg.sweeps ?? 10));
    const rnd = lcg(cfg.seed ?? 21);
    let x = 0;
    let y = 0;
    let cx = 0;
    let step = 0;
    const frame = (t: number, desc: string): VisualFrame => {
        const vals = [x, y];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `v-${i}`,
            type: "cell" as const,
            label: `${i === 0 ? "X" : "Y"}=${v}`,
            value: v,
            state: (i === (t % 2 === 0 ? 1 : 0) && t > 0 ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: t,
            layout: "grid",
            meta: { sweep: t, x, y, meanX: t > 0 ? Math.round((cx / t) * 100) / 100 : 0 },
        };
    };
    yield frame(0, "Start (X,Y)=(0,0); each sweep resamples X|Y then Y|X.");
    step += 1;
    for (let t = 1; t <= sweeps; t += 1) {
        x = rnd() < 0.3 + 0.5 * y ? 1 : 0;
        y = rnd() < 0.4 + 0.3 * x ? 1 : 0;
        cx += x;
        yield frame(
            t,
            `Sweep ${t}: drew X=${x} given Y, then Y=${y} given X (mean X ≈ ${(cx / t).toFixed(2)}).`,
        );
        step += 1;
    }
    yield frame(
        sweeps + 1,
        `Done: empirical P(X=1) ≈ ${(cx / sweeps).toFixed(2)} over ${sweeps} sweeps.`,
    );
}

const module: AlgorithmModule = {
    id: "gibbs-sampling",
    name: "Gibbs Sampling",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { sweeps: 10, seed: 21 },
    visualType: "grid",
    run,
};

export default module;
