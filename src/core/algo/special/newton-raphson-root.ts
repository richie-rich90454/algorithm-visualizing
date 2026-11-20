/**
 * newton-raphson-root.ts – Newton–Raphson Root Finding.
 * Solves x^2-2=0 from x=1 via x -= (x^2-2)/2x, doubling correct
 * digits each step. Cells accumulate the iterate history.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { start?: number; iters?: number } | null) ?? {};
    let x = Number.isFinite(cfg.start) && (cfg.start as number) !== 0 ? (cfg.start as number) : 1;
    const iters = Math.max(1, Math.min(8, cfg.iters ?? 5));
    const hist = [x];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = hist.map((v, i) => ({
            id: `it-${i}`,
            type: "cell" as const,
            label: v.toFixed(5),
            value: Math.round(v * 100000) / 100000,
            state: (i === hist.length - 1 ? "comparing" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        const r = x * x - 2;
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "grid",
            meta: {
                x: Math.round(x * 100000) / 100000,
                residual: Math.round(Math.abs(r) * 100000) / 100000,
            },
        };
    };
    yield frame(`Start x=1: residual ${(1 - 2).toFixed(0)} in magnitude.`, 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        x -= (x * x - 2) / (2 * x);
        hist.push(x);
        yield frame(`Iteration ${t}: tangent at previous x crosses zero at ${x.toFixed(6)}.`, t);
        step += 1;
    }
    yield frame(`Root ≈ ${x.toFixed(6)} (true √2 ≈ 1.414214).`, iters + 1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Newton-Raphson finds roots of a differentiable function using tangent lines. At a guess x, evaluate f(x) and its derivative f'(x), then follow the tangent down to where it crosses zero: x becomes x minus f(x)/f'(x). Near a simple root this roughly doubles the number of correct digits each iteration, known as quadratic convergence.",
        "invariants": [
            "The iterates are recorded in order and the residual shrinks near the root.",
            "For f(x)=x^2-2 with a positive start, all iterates stay positive and converge to sqrt(2).",
            "The update requires f'(x) to be nonzero."
        ],
        "correctness": "The tangent at x has equation y=f(x)+f'(x)(x'-x); setting y=0 gives the update x'=x-f(x)/f'(x). A Taylor expansion shows the new error is proportional to the square of the old error, so convergence is quadratic for a simple root with a sufficiently good initial guess.",
        "complexityRationale": "Each iteration evaluates f and f' and performs one division, constant work, so t iterations cost O(t). Only the current x is needed for the computation; the iterate history is kept for display, O(t) space.",
        "uses": [
            "Solving nonlinear equations in engineering and physics",
            "Computing square roots in hardware and math libraries",
            "Root-finding in numerical software and optimization",
            "Power-flow analysis, graphics intersections and iterative solvers"
        ],
        "references": [
            "Burden and Faires, Numerical Analysis, Chapter 2",
            "Press et al., Numerical Recipes, Chapter 9"
        ],
        "workedExample": "Solve x^2-2=0 from x=1. Here f(1)=-1 and f'=2, so x becomes 1-(-1)/2=1.5. Next f(1.5)=0.25 and f'=3, giving 1.5-0.25/3≈1.4167. The next iterate is about 1.4142157, rapidly approaching sqrt(2)≈1.414214."
    },
    id: "newton-raphson-root",
    name: "Newton–Raphson Root",
    category: "math",
    complexity: { time: "O(t)", space: "O(t)" },
    defaultInput: { start: 1, iters: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize guess x with iteration budget iters",
        "for iteration t <- 1 to iters",
        "evaluate function r <- x^2 minus 2",
        "follow tangent crossing to update x",
        "record iterate history for display",
        "watch residual shrink quadratically",
        "done: x approximates sqrt(2) at 1.414214",
    ],
};

export default module;
