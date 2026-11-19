/**
 * lambert-w-function.ts - Lambert W by Newton Iteration.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Lambert W function is the inverse of w -> w*exp(w). This module computes
 * the principal real branch W0(x) for x >= -1/e by Newton's method on
 * f(w) = w*exp(w) - x, whose derivative is exp(w)*(w+1).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) Newton steps, each constant work
 *   Space: O(k) for the displayed iteration table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row records the step, current w and residual w*exp(w)-x.
 *   - The most recent row is highlighted; the final row is green.
 *   - The final frame reports the value of W0(x).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LambertInput {
    x?: number;
    iterations?: number;
}

interface Row {
    step: number;
    w: number;
    residual: number;
}

function fmt(value: number): string {
    return Number.isFinite(value) ? value.toPrecision(9) : String(value);
}

function makeEntities(rows: Row[], done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (const row of rows) {
        const values: Array<[string, number]> = [
            ["step", row.step],
            ["w", row.w],
            ["residual", row.residual],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${row.step}-${col}`,
                type: "cell" as const,
                label: `${name}=${fmt(value)}`,
                value,
                state: (done ? "sorted" : row === rows[rows.length - 1] ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: row.step, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LambertInput | null) ?? {};
    const x = typeof task.x === "number" ? task.x : 1;
    const iterations = typeof task.iterations === "number" && task.iterations > 0
        ? Math.trunc(task.iterations)
        : 12;
    const lowerBound = -1 / Math.E;

    if (x < lowerBound) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: `No real Lambert W value exists for x=${fmt(x)} below -1/e.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 0, cols: 3, x, error: true, value: 0 },
        };
        return;
    }

    let w = x >= 0 ? (x < 1 ? x : Math.log(x + 1)) : -0.5;
    const rows: Row[] = [{ step: 0, w, residual: w * Math.exp(w) - x }];

    yield {
        stepNumber: 0,
        entities: makeEntities(rows, false),
        edges: [],
        description: `Solving w*exp(w)=${fmt(x)} for the principal branch, starting at w=${fmt(w)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 3, x, w, residual: rows[0]?.residual ?? 0 },
    };

    for (let step = 1; step <= iterations; step += 1) {
        const ew = Math.exp(w);
        const residual = w * ew - x;
        if (Math.abs(residual) < 1e-14) {
            break;
        }
        const derivative = ew * (w + 1);
        if (!Number.isFinite(derivative) || derivative === 0) {
            break;
        }
        w -= residual / derivative;
        rows.push({ step, w, residual: w * Math.exp(w) - x });
        yield {
            stepNumber: step,
            entities: makeEntities(rows, false),
            edges: [],
            description: `Newton step ${step}: w is now ${fmt(w)} with residual ${fmt(w * Math.exp(w) - x)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: rows.length, cols: 3, x, w, residual: rows[rows.length - 1]?.residual ?? 0 },
        };
    }

    const finalResidual = w * Math.exp(w) - x;
    yield {
        stepNumber: rows.length,
        entities: makeEntities(rows, true),
        edges: [],
        description: `Done: W(${fmt(x)}) is about ${fmt(w)}, leaving residual ${fmt(finalResidual)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: rows.length, cols: 3, x, value: w, residual: finalResidual },
    };
}

const module: AlgorithmModule = {
    id: "lambert-w-function",
    name: "Lambert W Function",
    category: "math",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { x: 1, iterations: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "define f(w) as w times exp(w) minus x",
        "choose a starting guess w for the principal branch",
        "repeat: set w to w minus f(w) divided by exp(w) times (w+1)",
        "stop when the residual f(w) is tiny",
        "done: report w as the principal Lambert W value",
    ],
    education: {
        intuition:
            "Lambert W answers the question: which number w satisfies w times e to the w equals x? There is no elementary closed form, so Newton's method solves f(w)=0 directly. The derivative of w exp(w) is exp(w)(w+1), which makes the Newton update short and fast near the principal real branch.",
        invariants: [
            "The residual equals w times exp(w) minus x and drives convergence.",
            "For x above -1/e the derivative exp(w)(w+1) stays positive on the principal branch.",
            "Each accepted Newton step keeps the residual smaller once near the root.",
            "No real principal value exists when x is below -1/e.",
        ],
        correctness:
            "Newton's method converges locally to a simple root of a smooth function. On the principal branch the root of f(w)=w exp(w)-x is simple because the derivative is nonzero for w>-1, which holds whenever x>-1/e. With a sensible start the iterates converge quadratically, so the returned w satisfies w exp(w)=x to machine precision.",
        complexityRationale:
            "Each Newton iteration evaluates an exponential and a few products, so k steps take O(k) time. Keeping one table row per step to visualize the convergence uses O(k) space.",
        uses: [
            "Solving equations where the unknown appears both linearly and in an exponent",
            "Analyzing algorithms with n log n growth inversions",
            "Physics and engineering models such as diode currents and delay equations",
        ],
        references: [
            "Corless, Gonnet, Hare and Jeffrey, On the Lambert W Function, 1996",
            "Wikipedia, Lambert W function, principal branch",
        ],
        workedExample:
            "For x=1 the iteration converges to W(1)=0.5671432904, the omega constant, because 0.5671432904 times exp(0.5671432904) equals 1. For x=e the answer is exactly 1.",
    },
};

export default module;
