/**
 * inverse-quadratic-interpolation.ts - Inverse Quadratic Interpolation
 *
 * A bracketed root finder. Given three points with distinct function values it
 * fits x as a quadratic function of f(x) and evaluates that parabola at zero.
 * Because the fitted variable is the axis being swapped, the method is called
 * inverse quadratic interpolation. It converges superlinearly while a bisection
 * fallback keeps the root bracketed and guarantees progress.
 *
 * Limits of the demo: the function is one of four named classroom functions,
 * and an initial sign-changing bracket is required. All arithmetic is exact
 * IEEE double precision; no user-supplied callbacks are evaluated.
 *
 * Time: O(iterations). Space: O(1).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type FuncName = "x2-2" | "x3-x-2" | "cos-x" | "exp-2";

const FUNCTIONS: Record<FuncName, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
    "cos-x": (x) => Math.cos(x) - x,
    "exp-2": (x) => Math.exp(x) - 2,
};

/** Evaluate the inverse quadratic through (a,fa),(b,fb),(c,fc) at y = 0. */
function inverseQuadratic(
    a: number,
    fa: number,
    b: number,
    fb: number,
    c: number,
    fc: number,
): number {
    if (fa === fb || fb === fc || fa === fc) {
        return Number.NaN;
    }
    const termA = (a * fb * fc) / ((fa - fb) * (fa - fc));
    const termB = (b * fa * fc) / ((fb - fa) * (fb - fc));
    const termC = (c * fa * fb) / ((fc - fa) * (fc - fb));
    return termA + termB + termC;
}

function makeBars(a: number, q: number, b: number, active: number): VisualEntity[] {
    const values = [a, q, b];
    const labels = ["a (lower)", "estimate", "b (upper)"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}=${value.toFixed(5)}`,
        value,
        state: index === active ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { func?: string; a?: number; b?: number; tol?: number; iterations?: number } | null
    ) ?? {};
    const name: FuncName =
        typeof task.func === "string" && task.func in FUNCTIONS
            ? (task.func as FuncName)
            : "x2-2";
    const f = FUNCTIONS[name];
    let a = typeof task.a === "number" ? task.a : 0;
    let b = typeof task.b === "number" ? task.b : 2;
    const tol = Math.max(1e-15, Number(task.tol ?? 1e-12));
    const maxIter = Math.max(1, Math.floor(Number(task.iterations ?? 30)) || 30);

    if (a > b) {
        [a, b] = [b, a];
    }
    let fa = f(a);
    let fb = f(b);
    const bracketed = fa === 0 || fb === 0 || fa * fb < 0;
    let c = a;
    let fc = fa;
    let bestEstimate = a;
    let bestResidual = Math.abs(fa);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(a, (a + b) / 2, b, 1),
        edges: [],
        description: `Bracket [${a}, ${b}] for ${name}; function values ${fa.toFixed(4)} and ${fb.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, b, fa, fb, bracketed, iterations: 0 },
    };
    step += 1;

    if (!bracketed) {
        yield {
            stepNumber: step,
            entities: makeBars(a, (a + b) / 2, b, 1),
            edges: [],
            description: "The endpoint values share a sign; no sign-changing bracket was supplied.",
            codeLineNumber: 8,
            layout: "array",
            meta: { a, b, fa, fb, bracketed: false, converged: false, iterations: 0 },
        };
        return;
    }

    for (let k = 0; k < maxIter; k += 1) {
        let q = inverseQuadratic(a, fa, b, fb, c, fc);
        if (!Number.isFinite(q) || q <= Math.min(a, b) || q >= Math.max(a, b)) {
            q = (a + b) / 2;
        }
        const fq = f(q);

        const oldA = a;
        const oldB = b;
        const oldFa = fa;
        const oldFb = fb;
        if (fa * fq <= 0) {
            b = q;
            fb = fq;
            c = oldB;
            fc = oldFb;
        } else {
            a = q;
            fa = fq;
            c = oldA;
            fc = oldFa;
        }

        const residual = Math.abs(fq);
        if (residual < bestResidual) {
            bestResidual = residual;
            bestEstimate = q;
        }
        const converged = residual <= tol || b - a <= tol;
        yield {
            stepNumber: step,
            entities: makeBars(a, q, b, 1),
            edges: [],
            description: `Iteration ${k + 1}: estimate ${q.toFixed(8)}, residual ${residual.toExponential(2)}; bracket width ${(b - a).toExponential(2)}.`,
            codeLineNumber: converged ? 8 : 4,
            layout: "array",
            meta: {
                a,
                b,
                fa,
                fb,
                estimate: q,
                residual,
                bracketWidth: b - a,
                iterations: k + 1,
                converged,
            },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    const estimate = bestEstimate;
    yield {
        stepNumber: step,
        entities: makeBars(a, estimate, b, 1),
        edges: [],
        description: `Root estimate ${estimate.toFixed(10)} with residual ${bestResidual.toExponential(2)} after ${step - 1} iteration(s).`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            root: estimate,
            residual: bestResidual,
            bracketed: true,
            converged: Math.abs(f(estimate)) <= tol,
            iterations: step - 1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Three points define a parabola, but here the roles of the axes are swapped: fit the input as a parabola in the output and evaluate it where the output is zero. That usually lands much closer to the root than a straight secant line. A bisection fallback takes over whenever the fitted point falls outside the bracket.",
        invariants: [
            "The two bracket endpoints always straddle a root, so f(a) and f(b) have opposite signs.",
            "Every new estimate lies inside the current bracket or is replaced by its midpoint.",
            "The bracket width never increases, so the method cannot stall.",
        ],
        correctness:
            "The inverse quadratic step is exact for a function whose inverse is quadratic, giving superlinear local convergence. The safeguard rejects any step outside the shrinking bracket and substitutes a midpoint, so the iteration inherits bisection's guaranteed convergence: the bracket width tends to zero and continuity forces f at the limit to be zero.",
        complexityRationale:
            "Each iteration performs a constant number of arithmetic operations and one function evaluation, so the time is O(iterations). Only a fixed handful of scalars are stored, giving O(1) space.",
        uses: [
            "Root polishing inside hybrid solvers such as Brent's method",
            "Solving scalar equations in engineering and physics codes",
            "Computing implied rates and yields in quantitative finance",
        ],
        references: [
            "Numerical Recipes, 3rd edition, Chapter 9 (Roots of Equations)",
            "Press, Teukolsky, Vetterling and Flannery, Numerical Recipes, Section 9.2",
        ],
        workedExample:
            "For f(x)=x^2-2 start with a=0, b=2 and c=0. The first estimate is not yet a true parabola so the midpoint 1 is used, giving f(1)=-1 and a new bracket [1,2]. With c=2 the inverse quadratic through (1,-1),(2,2),(0,-2) evaluates near 1.4, and a few more steps settle on the square root of two.",
    },
    id: "inverse-quadratic-interpolation",
    name: "Inverse Quadratic Interpolation",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { func: "x2-2", a: 0, b: 2, tol: 1e-12, iterations: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a bracket [a, b] with f(a) and f(b) of opposite signs",
        "set the third point c to a and evaluate all three values",
        "for each iteration up to the limit",
        "fit x as a quadratic in f(x) through a, b and c and set it to zero",
        "if that estimate is not inside the bracket use the midpoint",
        "evaluate f at the new estimate",
        "replace the endpoint that keeps the sign change and shift c",
        "stop when the residual or bracket width is below tolerance",
        "report the midpoint of the final bracket as the root",
    ],
};

export default module;
