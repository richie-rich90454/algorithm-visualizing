/**
 * regula-falsi-illinois.ts - Illinois Variant of False Position
 *
 * Finds a root in a sign-changing bracket by drawing a chord between the
 * endpoints, but halves the function value at an endpoint that is retained for
 * several consecutive steps. This prevents the stagnation that afflicts plain
 * false position when one endpoint never moves, while keeping the root bracketed.
 *
 *   Time:  O(iterations) evaluations
 *   Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionId = "x2-2" | "x3-x-2";

interface IllinoisInput {
    f?: FunctionId;
    a?: number;
    b?: number;
    iterations?: number;
}

const FUNCTIONS: Record<FunctionId, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
};

function makeEntities(fn: (x: number) => number, a: number, b: number, lo: number, hi: number): VisualEntity[] {
    const count = 41;
    const span = 4;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        const x = -span + (2 * span * i) / (count - 1);
        const y = fn(x);
        const inBracket = x >= lo && x <= hi;
        entities.push({
            id: `sample-${i}`,
            type: "node" as const,
            label: y.toFixed(2),
            value: y,
            state: (inBracket ? "active" : x >= a && x <= b ? "comparing" : "idle") as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, x, y },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as IllinoisInput | null) ?? {};
    const f: FunctionId = task.f === "x3-x-2" ? "x3-x-2" : "x2-2";
    const fn = FUNCTIONS[f];
    const a0 = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 1;
    const b0 = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : 2;
    const maxIterations = typeof task.iterations === "number" && task.iterations >= 1 && task.iterations <= 200
        ? Math.trunc(task.iterations)
        : 60;

    let a = Math.min(a0, b0);
    let b = Math.max(a0, b0);
    let fa = fn(a);
    let fb = fn(b);
    if (fa * fb > 0) {
        a = 1;
        b = 2;
        fa = fn(a);
        fb = fn(b);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(fn, a, b, a, b),
        edges: [],
        description: `Illinois false position on [${a}, ${b}] with endpoint values ${fa.toFixed(3)} and ${fb.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { rows: 1, cols: 41, f, a, b, iterations: 0, root: (a + b) / 2 },
    };
    step += 1;

    let side = 0;
    let root = (a + b) / 2;
    let used = 0;
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const denominator = fb - fa;
        if (denominator === 0) break;
        const c = (a * fb - b * fa) / denominator;
        const fc = fn(c);
        const keptLeft = fa * fc < 0;
        root = c;
        used = iteration;
        if (keptLeft) {
            b = c;
            fb = fc;
            if (side === 1) fa /= 2;
            side = 1;
        } else {
            a = c;
            fa = fc;
            if (side === 2) fb /= 2;
            side = 2;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(fn, Math.min(a0, b0), Math.max(a0, b0), a, b),
            edges: [],
            description: `Iteration ${iteration}: chord crossing ${c.toFixed(8)}, bracket narrows to [${a.toFixed(6)}, ${b.toFixed(6)}].`,
            codeLineNumber: keptLeft ? 2 : 3,
            layout: "point",
            meta: { rows: 1, cols: 41, f, a, b, root, iterations: iteration, residual: Math.abs(fc) },
        };
        step += 1;
        if (Math.abs(fc) < 1e-14 || Math.abs(b - a) < 1e-14) break;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(fn, Math.min(a0, b0), Math.max(a0, b0), a, b),
        edges: [],
        description: `Done: root about ${root.toFixed(10)} after ${used} iterations with residual ${Math.abs(fn(root)).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { rows: 1, cols: 41, f, a, b, root, iterations: used, residual: Math.abs(fn(root)) },
    };
}

const module: AlgorithmModule = {
    id: "regula-falsi-illinois",
    name: "Illinois False Position",
    category: "math",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { f: "x2-2", a: 1, b: 2, iterations: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a bracket [a,b] with f(a) and f(b) of opposite sign",
        "compute the chord crossing c = (a*f(b) - b*f(a)) / (f(b) - f(a))",
        "if f(a) and f(c) have opposite sign replace b by c",
        "otherwise replace a by c",
        "if the same endpoint was kept twice halve its function value",
        "repeat until the residual or the bracket is tiny",
        "done: report the root approximation",
    ],
    education: {
        intuition:
            "False position keeps a root trapped between two endpoints but can stall when one side barely moves. The Illinois fix notices a retained endpoint and halves its function value, which effectively pulls the next chord toward the stagnant side. The bracket is never abandoned, so convergence is guaranteed while the stall disappears.",
        invariants: [
            "The true root always lies inside the current bracket [a, b].",
            "The endpoints used for interpolation have opposite-signed values.",
            "Halving a retained endpoint value only changes the next interpolation, not the bracket.",
        ],
        correctness:
            "Each chord crossing lies inside the bracket because the interpolated values at the endpoints have opposite signs. When f(a) and f(c) disagree in sign the root is in [a, c], otherwise it is in [c, b], so replacing the correct endpoint preserves the bracket by the intermediate value theorem. Halving a stagnant endpoint value shifts the interpolation weight toward that side without moving an endpoint, so bracketing is unaffected. The shrinking bracket and the modified weights drive the residual to zero.",
        complexityRationale:
            "Each iteration performs one function evaluation and a constant number of arithmetic operations, so the cost is O(iterations). Only the endpoints, their values, and a side flag are stored, giving O(1) space.",
        uses: [
            "Root finding in engineering equations with a guaranteed bracket",
            "Solving implicit equations in simulation code",
            "A reliable fallback when Newton steps leave the bracket",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, False-Position Method",
            "Wikipedia, Regula falsi, Illinois algorithm",
        ],
        workedExample:
            "For x squared minus two on [1, 2], the first chord crosses near 1.333. Since f(1) and f(1.333) have opposite signs, b moves to 1.333 and a is retained. Repeating with the Illinois adjustment converges to 1.4142135624, the square root of two, without the left endpoint freezing.",
    },
};

export default module;
