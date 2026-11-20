/**
 * physics-informed-neural-network.ts - Physics-Informed Neural Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A PINN trains a neural network to satisfy a differential equation, not just
 * fit data. The loss combines the error at boundary points with the residual
 * of the governing equation, evaluated by differentiating the network. This
 * module uses a finite-difference approximation of the second derivative so
 * the residual can be verified exactly on a grid.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n grid points
 *   Space: O(n) for the residual array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the predicted solution values on the grid.
 *   - Interior bars switch to the equation residual in the middle frame.
 *   - The final frame reports the total composite loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PinnInput {
    u?: number[];
    f?: number[];
    h?: number;
    bcLeft?: number;
    bcRight?: number;
    residualWeight?: number;
}

/** Finite-difference residual u''(x_i) - f(x_i) at interior grid points. */
export function pinnResidual(u: number[], f: number[], h: number): number[] {
    const n = u.length;
    const residual = new Array(n).fill(0) as number[];
    if (h === 0) return residual;
    for (let i = 1; i < n - 1; i += 1) {
        residual[i] = ((u[i + 1] ?? 0) - 2 * (u[i] ?? 0) + (u[i - 1] ?? 0)) / (h * h) - (f[i] ?? 0);
    }
    return residual;
}

/** Combine boundary data error with the mean squared equation residual. */
export function pinnLoss(
    u: number[],
    f: number[],
    h: number,
    bcLeft: number,
    bcRight: number,
    residualWeight: number,
) {
    const residual = pinnResidual(u, f, h);
    const dataLoss = ((u[0] ?? 0) - bcLeft) ** 2 + ((u[u.length - 1] ?? 0) - bcRight) ** 2;
    let interiorSum = 0;
    let interiorCount = 0;
    for (let i = 1; i < u.length - 1; i += 1) {
        interiorSum += (residual[i] ?? 0) ** 2;
        interiorCount += 1;
    }
    const residualLoss = interiorCount === 0 ? 0 : interiorSum / interiorCount;
    const total = dataLoss + residualWeight * residualLoss;
    return { residual, dataLoss, residualLoss, total };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PinnInput | null) ?? {};
    const u: number[] = task.u ?? [0, 0.0625, 0.25, 0.5625, 1];
    const f: number[] = task.f ?? u.map(() => 2);
    const h = typeof task.h === "number" ? task.h : 0.25;
    const bcLeft = typeof task.bcLeft === "number" ? task.bcLeft : 0;
    const bcRight = typeof task.bcRight === "number" ? task.bcRight : 1;
    const residualWeight = typeof task.residualWeight === "number" ? task.residualWeight : 1;
    const { residual, dataLoss, residualLoss, total } = pinnLoss(u, f, h, bcLeft, bcRight, residualWeight);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(u, u.map(() => "idle")),
        edges: [],
        description: `Network predicts ${u.length} solution values on the grid.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "solution", h, dataLoss, residualLoss, total: 0, residual: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            residual,
            residual.map((_, i) => (i === 0 || i === residual.length - 1 ? "idle" : "comparing")),
        ),
        edges: [],
        description: "Approximate the second derivative with central finite differences.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "residual", h, dataLoss, residualLoss, total: 0, residual },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(residual, residual.map(() => "sorted")),
        edges: [],
        description: `Boundary error ${dataLoss.toFixed(6)}, mean residual ${residualLoss.toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "loss", h, dataLoss, residualLoss, total, residual },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(u, u.map(() => "sorted")),
        edges: [],
        description: `Done: total physics-informed loss is ${total.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", h, dataLoss, residualLoss, total, residual, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A physics-informed neural network is trained with more than just labeled examples. Its loss also measures how badly the predicted function violates a known differential equation. By adding the equation residual to the boundary error, the network is nudged toward solutions that obey physics even where no data exists.",
        invariants: [
            "The residual is zero at the two boundary grid points.",
            "The data loss depends only on the boundary values of the solution.",
            "The total loss is nonnegative and is a weighted sum of data and residual terms.",
        ],
        correctness:
            "The central difference quotient (u[i+1] minus 2u[i] plus u[i-1]) over h squared is a second-order accurate approximation to the second derivative on a uniform grid, so subtracting the forcing term f gives the equation residual at each interior point. Squaring and averaging these residuals penalizes violations, while the boundary term enforces the known values. Because both terms are nonnegative, the weighted sum is zero exactly when the discrete solution satisfies the boundary conditions and the finite-difference equation at every interior point.",
        complexityRationale:
            "Computing residuals visits each interior grid point once, costing O(n), and the loss reductions are also O(n). The residual array uses O(n) space.",
        uses: [
            "Solving forward and inverse problems with sparse data",
            "Surrogate modeling of physical systems",
            "Enforcing conservation laws and boundary conditions in learning",
        ],
        references: [
            "Raissi, Perdikaris and Karniadakis, Physics-Informed Neural Networks, Journal of Computational Physics 2019",
            "Cuomo et al., Scientific Machine Learning Through Physics-Informed Neural Networks, 2022",
        ],
        workedExample:
            "On the grid 0, 0.25, 0.5, 0.75, 1 with u equal to x squared and forcing f equal to 2, the finite-difference second derivative is 2 at every interior point, so each residual is zero. The boundary values already match zero and one, giving a total loss of exactly zero.",
    },
    id: "physics-informed-neural-network",
    name: "Physics-Informed Neural Network (PINN)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        u: [0, 0.0625, 0.25, 0.5625, 1],
        f: [2, 2, 2, 2, 2],
        h: 0.25,
        bcLeft: 0,
        bcRight: 1,
        residualWeight: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read grid values, forcing, spacing and boundary conditions",
        "approximate the second derivative at each interior point",
        "subtract the forcing to form the equation residual",
        "square and average the interior residuals",
        "add the squared boundary errors",
        "combine the terms into the total weighted loss",
        "done: report the residual array and total loss",
    ],
};

export default module;
