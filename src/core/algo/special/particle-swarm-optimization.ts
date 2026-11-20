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
            codeLineNumber: Math.min(line, 6),
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

    education: {
        "intuition": "Particle Swarm Optimization is a population-based optimizer inspired by flocking birds. Each particle moves through the search space with a velocity continually adjusted toward its own best-found position and the swarm's best-found position, plus some inertia. The mix of personal memory and social sharing pulls the swarm toward good solutions.",
        "invariants": [
            "Each particle remembers the position with the best fitness it has personally seen.",
            "The swarm best is the best personal best across all particles and never gets worse.",
            "Positions stay clamped within the search bounds."
        ],
        "correctness": "PSO is a metaheuristic without a general convergence proof to a global optimum. The update rule guarantees that personal and global bests are monotone, so the algorithm never forgets a good solution; convergence to a local or global optimum is empirical and depends on the inertia and social parameters.",
        "complexityRationale": "Each iteration updates n particles with constant-time velocity and position arithmetic, O(n), so t iterations cost O(t·n). Storing positions, velocities and bests for n particles uses O(n) space.",
        "uses": [
            "Engineering design and aerodynamic optimization",
            "Neural-network training and hyperparameter tuning",
            "Robotics path planning and antenna design",
            "Feature selection and clustering"
        ],
        "references": [
            "Kennedy and Eberhart, Particle Swarm Optimization, ICNN 1995",
            "Shi and Eberhart, A Modified Particle Swarm Optimizer, IEEE CEC 1998"
        ],
        "workedExample": "Four particles scatter in [0,6], scored by (x-3)^2. A particle at x=1 with personal best 2 and swarm best 2.8 adjusts its velocity toward both targets and moves closer to 3. Over five iterations the swarm clusters near x=3 with fitness near zero."
    },
    id: "particle-swarm-optimization",
    name: "Particle Swarm Optimization",
    category: "math",
    complexity: { time: "O(t·n)", space: "O(n)" },
    defaultInput: { particles: 4, iters: 5, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "scatter n particles on [0,6] with random velocities",
        "evaluate fitness (x-3)^2 tracking personal bests",
        "remember global best across the whole swarm",
        "update velocity with inertia plus social pulls",
        "move particles clamped inside the bounds",
        "repeat for each iteration t",
        "done: swarm converged near optimum x=3",
    ],
};

export default module;
