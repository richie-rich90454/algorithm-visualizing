/**
 * proximal-point.ts - Proximal Point Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The proximal point algorithm replaces a hard minimization by a sequence of
 * well-behaved subproblems. Each step moves to the minimizer of the objective
 * plus a quadratic penalty centered at the current iterate. For a one-dimensional
 * quadratic objective this proximal map has a closed form, so the iterates
 * contract geometrically toward the minimizer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) closed-form updates
 *   Space: O(iterations) to keep the displayed iterate sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per iterate, so the sequence visibly marches toward the target.
 *   - The newest iterate is highlighted and earlier ones are sorted.
 *   - The final frame reports the last iterate and its objective gap in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** One proximal point update for f(x) = a/2 * (x - c)^2. */
function proxStep(x: number, a: number, c: number, gamma: number): number {
    return (x + gamma * a * c) / (1 + gamma * a);
}

/** Build bars for the iterate sequence. */
function makeBars(values: number[], target: number): VisualEntity[] {
    return values.map((value, index) => {
        const isLast = index === values.length - 1;
        const state: EntityState = isLast ? "highlight" : "sorted";
        return {
            id: `iter-${index}`,
            type: "bar" as const,
            label: `x${index}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, isTarget: Math.abs(value - target) < 1e-12 },
        };
    });
}

/** Converge to the minimizer with closed-form proximal updates. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        a?: number;
        c?: number;
        x0?: number;
        gamma?: number;
        iterations?: number;
    } | null) ?? {};
    const a = typeof task.a === "number" && task.a > 0 ? task.a : 2;
    const c = typeof task.c === "number" ? task.c : 5;
    const x0 = typeof task.x0 === "number" ? task.x0 : 0;
    const gamma = typeof task.gamma === "number" && task.gamma > 0 ? task.gamma : 0.5;
    const iterations = typeof task.iterations === "number" ? Math.max(0, Math.min(200, Math.floor(task.iterations))) : 12;

    const factor = 1 / (1 + gamma * a);
    const iterates = [x0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(iterates, c),
        edges: [],
        description: `Minimizing a/2 (x - c)^2 with a = ${a}, c = ${c}, and step gamma = ${gamma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, c, gamma, x0, iterations, factor, x: x0, iteration: 0 },
    };
    step += 1;

    for (let k = 0; k < iterations; k += 1) {
        const current = iterates[iterates.length - 1] ?? x0;
        const next = proxStep(current, a, c, gamma);
        iterates.push(next);
        const objective = 0.5 * a * (next - c) * (next - c);
        yield {
            stepNumber: step,
            entities: makeBars(iterates, c),
            edges: [],
            description: `Iteration ${k + 1}: proximal map moves x from ${current.toFixed(5)} to ${next.toFixed(5)}.`,
            codeLineNumber: k < iterations - 1 ? 3 : 5,
            layout: "array",
            meta: {
                a,
                c,
                gamma,
                factor,
                iteration: k + 1,
                x: next,
                objective,
                gap: Math.abs(next - c),
            },
        };
        step += 1;
    }

    const finalX = iterates[iterates.length - 1] ?? x0;
    yield {
        stepNumber: step,
        entities: makeBars(iterates, c),
        edges: [],
        description: `Converged toward the minimizer ${c}; final iterate ${finalX.toFixed(6)} after ${iterations} step(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            a,
            c,
            gamma,
            factor,
            iterations,
            x: finalX,
            gap: Math.abs(finalX - c),
            objective: 0.5 * a * (finalX - c) * (finalX - c),
            iterates: iterates.slice(),
        },
    };
}

/** The proximal point module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Some objectives are awkward to minimize directly, so the proximal point algorithm solves a slightly modified problem at each step: minimize the objective plus a penalty for straying too far from where you are. The penalty is a squared distance, which makes each subproblem strongly convex. Repeating the move converges to a minimizer of the original objective.",
        invariants: [
            "Each iterate minimizes the objective plus one over two gamma times the squared distance to the previous iterate.",
            "For the quadratic objective, consecutive gaps to the minimizer shrink by the fixed factor 1/(1 + gamma a).",
            "The objective value decreases monotonically toward its minimum at c.",
        ],
        correctness:
            "The proximal map for f(x) = a/2 (x - c)^2 satisfies zero equals a(x+ - c) plus (1/gamma)(x+ - x), which solves to x+ = (x + gamma a c)/(1 + gamma a). Subtracting c gives (x - c)/(1 + gamma a), so the error is multiplied each step by a factor strictly between zero and one. The sequence therefore converges geometrically to c, the unique minimizer.",
        complexityRationale:
            "Each update is a constant-time arithmetic expression, so k iterations take time O(k). Storing every iterate for the bar sequence uses O(k) space.",
        uses: [
            "Regularized convex optimization and machine learning objectives",
            "Splitting methods such as the alternating direction method of multipliers",
            "Image reconstruction with nonsmooth penalties",
        ],
        references: [
            "Rockafellar, Monotone Operators and the Proximal Point Algorithm, 1976",
            "Boyd and Vandenberghe, Convex Optimization, Section 2.2.3",
        ],
        workedExample:
            "With a = 2, c = 5, gamma = 0.5, and x0 = 0, each step halves the distance to the target. The iterates are 0, 2.5, 3.75, 4.375 and so on, approaching 5 with error multiplied by one half each time.",
    },
    id: "proximal-point",
    name: "Proximal Point Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { a: 2, c: 5, x0: 0, gamma: 0.5, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read objective parameters a and c, start x0, and step gamma",
        "set the contraction factor to 1 over 1 plus gamma times a",
        "for k from 0 to iterations minus one",
        "set x_next to x plus gamma times a times c, over 1 plus gamma times a",
        "record x_next and compute its objective value",
        "stop early when the gap to the minimizer is negligible",
        "done: report the final iterate and its objective gap",
    ],
};

export default module;
