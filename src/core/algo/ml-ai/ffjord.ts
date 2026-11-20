/**
 * ffjord.ts - FFJORD Continuous Normalizing Flow
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FFJORD computes exact log-likelihoods for continuous normalizing flows by
 * integrating the instantaneous change-of-variables formula. The log density
 * changes at a rate equal to minus the trace of the dynamics Jacobian. The
 * trace is estimated with Hutchinson's randomized estimator, which needs only
 * vector-Jacobian products and avoids forming the full Jacobian.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * (d squared + samples * d squared))
 *   Space: O(steps * d) for the trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the evolving state and the accumulated log density as the
 *     flow integrates forward in time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FfjordInput {
    matrix?: number[][];
    x0?: number[];
    totalTime?: number;
    steps?: number;
    traceSamples?: number;
    seed?: number;
}

/** Multiply a square matrix by a vector. */
export function matVec(matrix: number[][], x: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
}

/** Deterministic uniform generator. */
function uniformGen(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Standard normal sample via Box-Muller. */
function gaussian(next: () => number): number {
    const u = Math.max(1e-12, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}

/** Hutchinson trace estimate: average of epsilon-transpose times A times epsilon. */
export function hutchinsonTrace(matrix: number[][], samples: number, seed: number): number {
    const next = uniformGen(seed);
    let total = 0;
    for (let s = 0; s < samples; s += 1) {
        const eps = matrix.map(() => gaussian(next));
        const product = matVec(matrix, eps);
        total += eps.reduce((sum, value, i) => sum + value * (product[i] ?? 0), 0);
    }
    return total / Math.max(1, samples);
}

/** Integrate a linear continuous flow, tracking the log-density change. */
export function ffjordFlow(
    matrix: number[][],
    x0: number[],
    totalTime: number,
    steps: number,
    traceSamples: number,
    seed: number,
): { trajectory: number[][]; logp: number; trace: number; logps: number[] } {
    const trace = hutchinsonTrace(matrix, traceSamples, seed);
    const h = totalTime / Math.max(1, steps);
    const trajectory: number[][] = [x0];
    const logps: number[] = [0];
    let x = x0;
    let logp = 0;
    for (let i = 0; i < steps; i += 1) {
        const dx = matVec(matrix, x).map((value) => h * value);
        x = x.map((value, j) => value + (dx[j] ?? 0));
        logp -= trace * h;
        trajectory.push(x);
        logps.push(logp);
    }
    return { trajectory, logp, trace, logps };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FfjordInput | null) ?? {};
    const matrix: number[][] = task.matrix ?? [[-1, 0.2], [0.1, -2]];
    const x0: number[] = task.x0 ?? [1, 0.5];
    const totalTime = typeof task.totalTime === "number" ? task.totalTime : 1;
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 5;
    const traceSamples = typeof task.traceSamples === "number" ? Math.max(1, task.traceSamples) : 256;
    const seed = typeof task.seed === "number" ? task.seed : 11;
    const { trajectory, logp, trace, logps } = ffjordFlow(
        matrix, x0, totalTime, steps, traceSamples, seed,
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars([...x0, 0], ["unvisited", "unvisited", "comparing"]),
        edges: [],
        description: `Integrate a ${x0.length}-dimensional flow for time ${totalTime} with ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { trace, logp: 0, trajectory: [x0], logps: [0] },
    };
    step += 1;

    for (let i = 1; i < trajectory.length; i += 1) {
        const point = trajectory[i] ?? [];
        yield {
            stepNumber: step,
            entities: bars([...point, logps[i] ?? 0], point.map((): EntityState => "active").concat("comparing")),
            edges: [],
            description: `Step ${i}: state (${point.map((v) => v.toFixed(2)).join(", ")}), log density ${(logps[i] ?? 0).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { trace, logp: logps[i] ?? 0, trajectory: trajectory.slice(0, i + 1), logps: logps.slice(0, i + 1) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars([...(trajectory[trajectory.length - 1] ?? []), logp], (trajectory[trajectory.length - 1] ?? []).map((): EntityState => "sorted").concat("sorted")),
        edges: [],
        description: `Done: estimated trace ${trace.toFixed(4)}, final log density ${logp.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { trace, logp, trajectory, logps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A continuous normalizing flow deforms a simple distribution into a complex one by flowing points along a learned vector field. To track how probabilities change, it uses the fact that log density changes at a rate equal to minus the trace of the field's Jacobian. FFJORD estimates that trace with random signs, which needs only directional derivatives and makes high-dimensional flows practical.",
        invariants: [
            "The state evolves according to dx/dt equals the vector field.",
            "Log density changes by minus the Jacobian trace times the time step.",
            "The Hutchinson estimator is unbiased: its expectation equals the true trace.",
        ],
        correctness:
            "The instantaneous change-of-variables theorem states that along the flow, the log density derivative is minus the divergence of the vector field, which is the trace of its Jacobian. Hutchinson's estimator uses random vectors with unit covariance, so the expectation of epsilon-transpose times Jacobian times epsilon equals the trace. Integrating the state with small steps approximates the flow solution, and accumulating minus trace times the step approximates the log-density integral. For a constant matrix field the divergence is constant, so the accumulated log change converges to minus the trace times total time.",
        complexityRationale:
            "Each step multiplies the matrix by the state and evaluates the trace estimator over a fixed number of random directions, costing O(samples * d squared) per step. The trajectory of states needs O(steps * d) storage.",
        uses: [
            "Exact likelihood evaluation for generative flows",
            "Density estimation on continuous data",
            "Invertible models with tractable probability computation",
        ],
        references: [
            "Grathwohl et al., FFJORD: Free-form Continuous Dynamics for Scalable Reversible Generative Models, ICLR 2019",
            "Chen, Rubanova, Bettencourt and Duvenaud, Neural Ordinary Differential Equations, NeurIPS 2018",
        ],
        workedExample:
            "For the matrix with diagonal minus one and minus two, the exact trace is minus three. Integrating for time one with the estimated trace gives a log-density change of about plus three, while the state contracts toward the origin according to the matrix exponential.",
    },
    id: "ffjord",
    name: "FFJORD Continuous Normalizing Flow",
    category: "ml-ai",
    complexity: { time: "O(steps * samples * d squared)", space: "O(steps d)" },
    defaultInput: {
        matrix: [[-1, 0.2], [0.1, -2]],
        x0: [1, 0.5],
        totalTime: 1,
        steps: 5,
        traceSamples: 256,
        seed: 11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the dynamics matrix, initial state and time span",
        "estimate the Jacobian trace with Hutchinson random signs",
        "for each time step advance the state along the vector field",
        "decrease log density by trace times the step size",
        "record the state and log density",
        "done: report the trajectory and final log density",
    ],
};

export default module;
