/**
 * mean-field-approximation.ts - Mean-Field Approximation (Curie-Weiss Ising)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Ising model is hard to solve exactly, but mean-field theory replaces the
 * fluctuating neighbors of each spin with their average, the magnetization m.
 * For a coordination number z, coupling J, inverse temperature beta, and field
 * h, self-consistency requires m = tanh(beta (z J m + h)). Iterating this map
 * finds the stable magnetization. When h is zero a nonzero solution appears
 * only below the critical temperature beta_c = 1 / (z J), signaling spontaneous
 * magnetization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k iterations until convergence
 *   Space: O(k) for the displayed iteration trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is the magnetization after one fixed-point iteration.
 *   - The final bar is green; the active bar is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface MeanFieldResult {
    magnetization: number;
    trajectory: number[];
    residual: number;
    criticalBeta: number;
    iterations: number;
}

/** Iterate the Curie-Weiss self-consistency map to a stable fixed point. */
export function meanFieldSolve(
    beta: number,
    z: number,
    J: number,
    h: number,
    initial: number,
    tolerance: number,
    maxIterations: number,
): MeanFieldResult {
    const criticalBeta = z * J > 0 ? 1 / (z * J) : Infinity;
    const trajectory: number[] = [];
    let m = initial === 0 ? 0.01 : initial;
    let iterations = 0;
    for (; iterations < maxIterations; iterations += 1) {
        const next = Math.tanh(beta * (z * J * m + h));
        const change = Math.abs(next - m);
        m = next;
        trajectory.push(m);
        if (change < tolerance) {
            iterations += 1;
            break;
        }
    }
    const residual = Math.abs(m - Math.tanh(beta * (z * J * m + h)));
    return { magnetization: m, trajectory, residual, criticalBeta, iterations };
}

function makeBars(trajectory: number[], active: number, done: boolean): VisualEntity[] {
    return trajectory.map((value, i) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (i === active) {
            state = "comparing";
        } else if (i < active) {
            state = "visited";
        }
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `m${i}=${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        beta?: number;
        z?: number;
        J?: number;
        h?: number;
        initial?: number;
        tolerance?: number;
        maxIterations?: number;
    } | null) ?? {};
    const beta = Math.max(0, Number(task.beta ?? 1.2) || 1.2);
    const z = Math.max(1, Number(task.z ?? 4) || 4);
    const J = Math.max(0.01, Number(task.J ?? 1) || 1);
    const h = Number(task.h ?? 0) || 0;
    const initial = Number(task.initial ?? 0.2) || 0;
    const tolerance = Math.max(1e-9, Number(task.tolerance ?? 1e-7) || 1e-7);
    const maxIterations = Math.max(2, Math.min(200, Math.floor(Number(task.maxIterations ?? 60) || 60)));
    const result = meanFieldSolve(beta, z, J, h, initial, tolerance, maxIterations);
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Mean-field Ising model: beta ${beta}, z ${z}, J ${J}, h ${h}; beta_c = ${result.criticalBeta.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { beta, z, J, h, betaC: result.criticalBeta, m: 0, residual: Infinity },
    };
    step += 1;

    for (let i = 0; i < result.trajectory.length; i += 1) {
        const m = result.trajectory[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(result.trajectory.slice(0, i + 1), i, false),
            edges: [],
            description: `Iteration ${i + 1}: m = tanh(${beta.toFixed(2)} x (${z} x ${J} x ${(result.trajectory[i - 1] ?? initial).toFixed(3)} + ${h})) = ${m.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { beta, z, J, h, betaC: result.criticalBeta, iteration: i + 1, m, residual: Math.abs(m - Math.tanh(beta * (z * J * m + h))) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.trajectory, -1, true),
        edges: [],
        description: `Converged to m = ${result.magnetization.toFixed(5)} in ${result.iterations} iterations; fixed-point residual ${result.residual.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            beta,
            z,
            J,
            h,
            betaC: result.criticalBeta,
            m: result.magnetization,
            residual: result.residual,
            iterations: result.iterations,
            trajectory: result.trajectory,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each spin feels the average influence of all its neighbors rather than tracking each one. That average is the magnetization, and requiring it to be self-consistent gives a single equation m = tanh(beta(z J m + h)). Iterating the equation is like asking the spins to repeatedly settle; below a critical temperature even a tiny initial bias grows into a spontaneous magnetization.",
        invariants: [
            "Every iterate lies strictly between minus one and one because tanh is bounded.",
            "The update rule preserves the sign of the average neighbor field.",
            "A converged magnetization satisfies the self-consistency equation to within tolerance.",
        ],
        correctness:
            "Mean-field theory replaces the local field by z J m plus h, and the Ising spin expectation under that field is tanh of beta times the field, giving the fixed-point map. The map is a contraction when the derivative beta z J sech^2(beta(z J m+h)) is below one, which holds for beta below beta_c = 1/(z J); there iteration converges to the unique root m=0 when h is zero. For beta above beta_c the symmetry is broken, and a small nonzero start converges to a stable nonzero root that also satisfies the equation.",
        complexityRationale:
            "Each iteration evaluates one tanh and one absolute difference, so k iterations cost O(k) time and the trajectory stores k values for O(k) space.",
        uses: [
            "Approximating phase transitions in interacting particle systems",
            "Providing tractable mean-field baselines in statistical physics",
            "Variational mean-field updates in graphical models and neural networks",
        ],
        references: [
            "Kardar, Statistical Physics of Particles, Chapter 4",
            "Chandler, Introduction to Modern Statistical Mechanics, Chapter 5",
        ],
        workedExample:
            "With z = 4, J = 1, h = 0, the critical inverse temperature is beta_c = 0.25. At beta = 0.2 and initial m = 0.2, repeated tanh updates shrink m toward zero. At beta = 0.5 the same start grows toward a nonzero magnetization near 0.64, the spontaneous order of the low-temperature phase.",
    },
    id: "mean-field-approximation",
    name: "Mean-Field Approximation",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { beta: 0.5, z: 4, J: 1, h: 0, initial: 0.2, tolerance: 1e-9, maxIterations: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "set the critical inverse temperature to one over z times J",
        "start the magnetization at the initial guess",
        "repeat while the change exceeds the tolerance",
        "set m to tanh of beta times z J m plus h",
        "measure the change from the previous magnetization",
        "record the new magnetization in the trajectory",
        "report the fixed point, residual, and critical temperature",
    ],
};

export default module;
