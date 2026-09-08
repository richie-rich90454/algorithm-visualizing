/**
 * particle-swarm-optimization.ts – Particle Swarm Optimization.
 * Four particles minimize (x-3)^2 on [0,6]: each tracks its own best
 * and the swarm best, updating velocity with inertia + cognition + social.
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

const f = (x: number): number => (x - 3) * (x - 3);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { particles?: number; iters?: number; seed?: number } | null) ?? {};
    const n = Math.max(2, Math.min(8, cfg.particles ?? 4));
    const iters = Math.max(1, Math.min(8, cfg.iters ?? 5));
    const rnd = lcg(cfg.seed ?? 7);
    const pos = Array.from({ length: n }, () => rnd() * 6);
    const vel = Array.from({ length: n }, () => rnd() * 2 - 1);
    const pbest = [...pos];
    let gbest = pbest.reduce((a, b) => (f(b) < f(a) ? b : a), pbest[0] ?? 3);
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = pos.map((x, i) => ({
            id: `p-${i}`,
            type: "bar" as const,
            label: x.toFixed(2),
            value: Math.max(0.01, x),
            state: (Math.abs(x - gbest) < 1e-9 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "array",
            meta: { gbest: Number(gbest.toFixed(4)), gfit: Number(f(gbest).toFixed(4)) },
        };
    };
    yield frame(`Swarm of ${n} particles scattered on [0,6], global best ${gbest.toFixed(2)}.`, 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        for (let i = 0; i < n; i += 1) {
            const r1 = rnd();
            const r2 = rnd();
            vel[i] =
                0.5 * (vel[i] ?? 0) +
                (r1 * ((pbest[i] ?? 3) - (pos[i] ?? 3)) + r2 * (gbest - (pos[i] ?? 3)));
            pos[i] = Math.min(6, Math.max(0, (pos[i] ?? 3) + (vel[i] ?? 0)));
            if (f(pos[i] ?? 3) < f(pbest[i] ?? 3)) pbest[i] = pos[i] ?? 3;
            if (f(pos[i] ?? 3) < f(gbest)) gbest = pos[i] ?? 3;
        }
        yield frame(
            `Iteration ${t}: velocities pulled toward personal + global best (g=${gbest.toFixed(3)}).`,
            t,
        );
        step += 1;
    }
    yield frame(
        `Converged near x=${gbest.toFixed(4)} with f=${f(gbest).toFixed(6)} (optimum x=3).`,
        iters + 1,
    );
}

const module: AlgorithmModule = {
    id: "particle-swarm-optimization",
    name: "Particle Swarm Optimization",
    category: "math",
    complexity: { time: "O(t·n)", space: "O(n)" },
    defaultInput: { particles: 4, iters: 5, seed: 7 },
    visualType: "array",
    run,
};

export default module;
