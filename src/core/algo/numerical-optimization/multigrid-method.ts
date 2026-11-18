/**
 * multigrid-method.ts - Multigrid V-Cycle for the One-Dimensional Poisson Equation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multigrid solves elliptic partial differential equations by attacking error
 * at every scale at once. A few relaxation sweeps remove high-frequency error
 * on a fine grid; the remaining smooth error is restricted to a coarser grid,
 * solved there, and interpolated back as a correction. Repeating this as a
 * V-cycle converges in almost grid-independent time. This module solves
 * -u'' = f with zero boundary conditions using nested grids and a direct solve
 * on the coarsest level.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) per V-cycle for N fine-grid unknowns
 *   Space: O(N) across all grid levels (geometric sum below N)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per fine-grid unknown shows the current approximate solution.
 *   - Bars are highlighted during the correction phase of each cycle.
 *   - Frame metadata records the phase, the cycle number, and the discrete
 *     residual norm so convergence is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Level = { n: number; h: number };

function buildLevels(finest: number): Level[] {
    const levels: Level[] = [];
    let n = finest;
    while (n >= 1) {
        levels.push({ n, h: 1 / (n + 1) });
        n = Math.floor((n - 1) / 2);
    }
    return levels;
}

function residual(u: number[], f: number[], h: number): number[] {
    const inv = 1 / (h * h);
    return u.map((ui, i) => {
        const left = i === 0 ? 0 : u[i - 1] ?? 0;
        const right = i === u.length - 1 ? 0 : u[i + 1] ?? 0;
        return (f[i] ?? 0) - inv * (2 * ui - left - right);
    });
}

function smooth(u: number[], f: number[], h: number, sweeps: number): void {
    const factor = (h * h) / 2;
    for (let s = 0; s < sweeps; s += 1) {
        for (let i = 0; i < u.length; i += 1) {
            const left = i === 0 ? 0 : u[i - 1] ?? 0;
            const right = i === u.length - 1 ? 0 : u[i + 1] ?? 0;
            u[i] = 0.5 * (left + right) + factor * (f[i] ?? 0);
        }
    }
}

function restrict(r: number[]): number[] {
    const m = Math.floor((r.length - 1) / 2);
    return Array.from({ length: m }, (_, j) =>
        0.25 * (r[2 * j] ?? 0) + 0.5 * (r[2 * j + 1] ?? 0) + 0.25 * (r[2 * j + 2] ?? 0),
    );
}

function prolong(e: number[], fineLength: number): number[] {
    const get = (j: number) => (j < 0 || j >= e.length ? 0 : (e[j] ?? 0));
    return Array.from({ length: fineLength }, (_, i) =>
        i % 2 === 1 ? get((i - 1) / 2) : 0.5 * (get(i / 2 - 1) + get(i / 2)),
    );
}

function directSolve(f: number[], h: number): number[] {
    const inv = 1 / (h * h);
    const n = f.length;
    const d = new Array<number>(n).fill(2 * inv);
    const rhs = f.map((v) => v);
    const off = -inv;
    for (let i = 1; i < n; i += 1) {
        const factor = off / (d[i - 1] ?? 1);
        d[i] = (d[i] ?? 0) - factor * off;
        rhs[i] = (rhs[i] ?? 0) - factor * (rhs[i - 1] ?? 0);
    }
    const x = new Array<number>(n).fill(0);
    x[n - 1] = (rhs[n - 1] ?? 0) / (d[n - 1] ?? 1);
    for (let i = n - 2; i >= 0; i -= 1) {
        x[i] = ((rhs[i] ?? 0) - off * (x[i + 1] ?? 0)) / (d[i] ?? 1);
    }
    return x;
}

function norm(values: number[]): number {
    return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
}

function makeBars(u: number[], state: EntityState, highlight: boolean): VisualEntity[] {
    return u.map((value, i) => ({
        id: `node-${i}`,
        type: "bar" as const,
        label: `u${i}=${value.toFixed(3)}`,
        value,
        state: highlight ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

/** The multigrid V-cycle generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { finest?: number; cycles?: number; sweeps?: number } | null) ?? {};
    let finest = Math.max(3, Math.floor(task.finest ?? 7));
    if ((finest + 1) & finest) {
        finest = 7;
    }
    const levels = buildLevels(finest);
    const cycles = Math.max(1, Math.min(12, Math.floor(task.cycles ?? 6)));
    const sweeps = Math.max(1, Math.min(4, Math.floor(task.sweeps ?? 2)));
    const fine = levels[0]!;
    const f = Array.from({ length: fine.n }, (_, i) => {
        const x = (i + 1) * fine.h;
        return Math.PI * Math.PI * Math.sin(Math.PI * x);
    });
    const u = new Array<number>(fine.n).fill(0);
    let step = 0;

    const emit = (description: string, codeLine: number, phase: string, cycle: number, highlight: boolean, extra: object = {}) => {
        const r = residual(u, f, fine.h);
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(u, phase === "correction" ? "comparing" : "idle", highlight),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: { phase, cycle, residualNorm: norm(r), values: [...u], gridSize: fine.n, levels: levels.length, ...extra },
        };
        step += 1;
        return frame;
    };

    yield emit("Starting with a zero guess on the finest grid; -u'' = pi squared sin(pi x).", 0, "initial", 0, false);

    const vcycle = (levelIndex: number, uLevel: number[], fLevel: number[], cycle: number) => {
        const level = levels[levelIndex]!;
        if (levelIndex === levels.length - 1) {
            const solved = directSolve(fLevel, level.h);
            for (let i = 0; i < uLevel.length; i += 1) {
                uLevel[i] = solved[i] ?? 0;
            }
            return;
        }
        smooth(uLevel, fLevel, level.h, sweeps);
        const r = residual(uLevel, fLevel, level.h);
        const rc = restrict(r);
        const ec = new Array<number>(rc.length).fill(0);
        vcycle(levelIndex + 1, ec, rc, cycle);
        const e = prolong(ec, uLevel.length);
        for (let i = 0; i < uLevel.length; i += 1) {
            uLevel[i] = (uLevel[i] ?? 0) + (e[i] ?? 0);
        }
        smooth(uLevel, fLevel, level.h, sweeps);
    };

    for (let cycle = 1; cycle <= cycles; cycle += 1) {
        const before = norm(residual(u, f, fine.h));
        vcycle(0, u, f, cycle);
        const after = norm(residual(u, f, fine.h));
        yield emit(
            `V-cycle ${cycle}: pre-smooth, restrict the residual, solve coarse, interpolate, post-smooth. Residual ${before.toExponential(2)} to ${after.toExponential(2)}.`,
            4,
            "correction",
            cycle,
            true,
            { residualBefore: before, residualAfter: after },
        );
    }

    yield emit("Multigrid converged; the fine-grid values approximate the exact discrete solution.", 7, "done", cycles, false, {
        done: true,
        exact: Array.from({ length: fine.n }, (_, i) => Math.sin(Math.PI * (i + 1) * fine.h)),
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain relaxation quickly removes short-wavelength error but barely touches long-wavelength error. Multigrid fixes this by moving the remaining smooth error to a coarser grid, where it looks shorter and is cheap to remove, then sending the correction back up. One pass down and back up is a V-cycle, and a handful of V-cycles solve the system to high accuracy.",
        invariants: [
            "Each grid level solves the residual equation for the error, not the original solution.",
            "Restriction and prolongation transfer only corrections between levels.",
            "The residual norm decreases after each V-cycle.",
        ],
        correctness:
            "Relaxation damps the high-frequency components of the error because Jacobi or Gauss-Seidel acts locally. The leftover error is smooth, so sampling it on a coarser grid and solving the coarse residual equation produces a good approximation to that error; interpolating it back and adding it corrects the fine solution. The coarse solve is exact at the coarsest level, so the recursion is well founded and each V-cycle is a contraction on the error.",
        complexityRationale:
            "The fine grid has N points and each coarser level has about half as many, so the total work over all levels is N plus N/2 plus N/4 and so on, which is O(N) per cycle. Storing all levels uses the same geometric sum, also O(N).",
        uses: [
            "Solving discretized partial differential equations in scientific codes",
            "Fast Poisson solvers in fluid and electrostatics simulations",
            "Preconditioners for large sparse linear systems",
        ],
        references: [
            "Brandt, Multi-Level Adaptive Solutions to Boundary-Value Problems, 1977",
            "Trottenberg, Oosterlee, and Schuller, Multigrid, 2001",
        ],
        workedExample:
            "On seven fine points for -u'' = pi squared sin(pi x), relaxation smooths the initial error; the residual is restricted to three points and then one point, solved exactly, and interpolated back. After several V-cycles the values match sin(pi x) at the grid points to high precision.",
    },
    id: "multigrid-method",
    name: "Multigrid V-Cycle",
    category: "numerical-optimization",
    complexity: { time: "O(N) per V-cycle", space: "O(N)" },
    defaultInput: { finest: 7, cycles: 6, sweeps: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "build nested grids by halving the number of interior points",
        "initialize the fine-grid solution to zero",
        "smooth the current grid a few times to remove high-frequency error",
        "compute the residual and restrict it to the next coarser grid",
        "recurse until the coarsest grid is solved directly",
        "interpolate the coarse correction back and add it to the fine solution",
        "smooth again and repeat for a fixed number of V-cycles",
        "done: report the converged fine-grid values",
    ],
};

export default module;
