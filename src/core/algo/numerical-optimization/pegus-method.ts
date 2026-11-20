/**
 * pegus-method.ts - Pegasus Root Finder
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pegasus is a bracketing root finder that improves on the false-position
 * method. When one endpoint becomes stale, instead of freezing its function
 * value Pegasus rescales that value using the newest function value. The
 * bracket is preserved at every step and the endpoint eventually moves, giving
 * faster and more reliable convergence than plain regula falsi.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations), two function evaluations per iteration at most
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the current bracket endpoints a and b.
 *   - A third bar shows the latest estimate c.
 *   - The final frame reports the root estimate and residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FnKind = "cubic" | "cosine" | "exponential";

/** Built-in test functions with a known simple root. */
function makeFunction(kind: FnKind): { f: (x: number) => number; root: number } {
    if (kind === "cosine") {
        return { f: (x) => Math.cos(x) - x, root: 0.7390851332151607 };
    }
    if (kind === "exponential") {
        return { f: (x) => Math.exp(x) - 3 * x, root: 0.6190612867369350 };
    }
    return { f: (x) => x * x * x - x - 2, root: 1.5213797068045676 };
}

function buildEntities(a: number, fa: number, b: number, fb: number, c: number | null): VisualEntity[] {
    const entries: Array<{ id: string; label: string; value: number; state: EntityState }> = [
        { id: "a", label: `a=${a.toFixed(4)}`, value: a, state: "pivot" },
        { id: "b", label: `b=${b.toFixed(4)}`, value: b, state: "pivot" },
    ];
    if (c !== null) entries.push({ id: "c", label: `c=${c.toFixed(4)}`, value: c, state: "active" });
    return entries.map((e) => ({
        id: `bar-${e.id}`,
        type: "bar" as const,
        label: e.label,
        value: e.value,
        state: e.state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { endpoint: e.id },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        kind?: FnKind;
        a?: number;
        b?: number;
        iterations?: number;
        tolerance?: number;
    } | null) ?? {};
    const kind: FnKind = task.kind === "cosine" || task.kind === "exponential" ? task.kind : "cubic";
    const { f } = makeFunction(kind);
    let a = typeof task.a === "number" ? task.a : 1;
    let b = typeof task.b === "number" ? task.b : 2;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 40;
    const tolerance = typeof task.tolerance === "number" ? task.tolerance : 1e-12;

    let fa = f(a);
    let fb = f(b);
    const validBracket = fa * fb <= 0;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(a, fa, b, fb, null),
        edges: [],
        description: validBracket
            ? `Starting Pegasus on ${kind} with bracket [${a}, ${b}].`
            : `Endpoints do not bracket a root; results may not converge.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { kind, a, b, fa, fb, phase: "start", validBracket },
    };

    if (validBracket) {
        for (let i = 0; i < iterations; i += 1) {
            const denominator = fb - fa;
            const c = Math.abs(denominator) < 1e-15 ? (a + b) / 2 : (a * fb - b * fa) / denominator;
            const fc = f(c);

            if (fa * fc > 0) {
                fa = (fa * fb) / (fb + fc);
                a = c;
            } else {
                fb = (fb * fa) / (fa + fc);
                b = c;
            }

            yield {
                stepNumber: step++,
                entities: buildEntities(a, fa, b, fb, c),
                edges: [],
                description: `Iteration ${i + 1}: false position ${c.toFixed(8)}, residual ${Math.abs(fc).toExponential(2)}; bracket width ${Math.abs(b - a).toExponential(2)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { kind, a, b, fa, fb, c, fc, iteration: i + 1, phase: "iterate" },
            };

            if (Math.abs(fc) < tolerance || Math.abs(b - a) < tolerance) break;
        }
    }

    const estimate = (a + b) / 2;
    const residual = Math.abs(f(estimate));
    yield {
        stepNumber: step++,
        entities: buildEntities(a, fa, b, fb, estimate),
        edges: [],
        description: `Pegasus finished: root near ${estimate.toFixed(10)} with residual ${residual.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { kind, estimate, residual, bracket: [a, b], validBracket, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The false-position method draws a secant between bracket endpoints, but one endpoint can stay fixed while the other creeps toward the root. Pegasus notices which side is stale and shrinks that endpoint's stored function value using the new value. This keeps the true root bracketed while nudging the secant toward the other side, so convergence speeds up.",
        invariants: [
            "The function values at the two endpoints keep opposite signs while the bracket is valid.",
            "Every new estimate lies inside the current bracket.",
            "Only the stale endpoint is replaced, and its stored function value is rescaled rather than copied.",
        ],
        correctness:
            "The secant estimate of a continuous function with opposite-signed endpoints stays inside the bracket. If the new point has the same sign as f(a), the new bracket is [c, b]; rescaling f(a) to f(a)f(b)/(f(b)+f(c)) preserves its sign because f(a) and f(b) have opposite signs and the denominator stays nonzero, so the bracket remains valid. The rescaling pulls the next secant away from the frozen side, and Pegasus is known to converge superlinearly for smooth roots.",
        complexityRationale:
            "Each iteration computes one secant, one function evaluation and a constant amount of arithmetic, so the cost is O(iterations) with O(1) stored values.",
        uses: [
            "Finding roots of smooth nonlinear equations in engineering",
            "Solving implicit equations in simulation and finance",
            "A stable bracketing alternative to regula falsi and secant methods",
        ],
        references: [
            "Dowell and Jarratt, A Modified Regula Falsi Method, 1971",
            "Press et al., Numerical Recipes, chapter on root finding",
        ],
        workedExample:
            "For x^3 - x - 2 on [1, 2], the first secant estimate is about 1.521. Since f(1) is negative and f(1.521) is also negative, the left endpoint moves to 1.521 and its stored value is rescaled, keeping the root bracketed near 1.5214.",
    },
    id: "pegus-method",
    name: "Pegasus Root Finder",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { kind: "cubic", a: 1, b: 2, iterations: 40, tolerance: 1e-12 },
    visualType: "array",
    run,
    pseudocode: [
        "read a bracket, iteration limit and tolerance",
        "evaluate the function at both endpoints",
        "for each iteration compute the false-position estimate",
        "evaluate the function at the new estimate",
        "replace the stale endpoint and rescale its stored value",
        "stop when the residual or bracket width is tiny",
        "done: report the root estimate and residual",
    ],
};

export default module;
