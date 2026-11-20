/**
 * remez-algorithm.ts - Remez Exchange for Minimax Linear Approximation
 *
 * The Remez algorithm computes the polynomial that minimizes the largest
 * approximation error over an interval. The optimal degree-one polynomial for
 * a convex function equioscillates at three points: both endpoints and one
 * interior point where the error derivative vanishes. Starting from a guess at
 * those points, Remez solves for the line and error height that alternate there,
 * then exchanges the interior point for the new error extremum.
 *
 * Limits of the demo: only degree-one approximation of exp(x) on [0, 1] is
 * implemented, for which the interior extremum x = ln(a) is known exactly; the
 * function and interval are fixed so the simulation is fully deterministic.
 *
 * Time: O(iterations) with a constant-size 3 by 3 solve. Space: O(1).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const INTERVAL: [number, number] = [0, 1];

/** Solve a 3 by 3 linear system by Gaussian elimination with pivoting. */
function solve3(matrix: number[][], rhs: number[]): number[] | null {
    const A = matrix.map((row) => row.slice());
    const b = rhs.slice();
    for (let col = 0; col < 3; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < 3; r += 1) {
            if (Math.abs((A[r] as number[])[col] as number) > Math.abs((A[pivot] as number[])[col] as number)) {
                pivot = r;
            }
        }
        if (Math.abs((A[pivot] as number[])[col] as number) < 1e-14) {
            return null;
        }
        [A[col], A[pivot]] = [A[pivot] as number[], A[col] as number[]];
        [b[col], b[pivot]] = [b[pivot] as number, b[col] as number];
        const pv = (A[col] as number[])[col] as number;
        for (let r = col + 1; r < 3; r += 1) {
            const factor = ((A[r] as number[])[col] as number) / pv;
            for (let c = col; c < 3; c += 1) {
                (A[r] as number[])[c] = ((A[r] as number[])[c] as number) - factor * ((A[col] as number[])[c] as number);
            }
            b[r] = (b[r] as number) - factor * (b[col] as number);
        }
    }
    const z = [0, 0, 0];
    for (let i = 2; i >= 0; i -= 1) {
        let sum = b[i] as number;
        for (let j = i + 1; j < 3; j += 1) {
            sum -= ((A[i] as number[])[j] as number) * (z[j] as number);
        }
        z[i] = sum / ((A[i] as number[])[i] as number);
    }
    return z;
}

/** Solve for a, b and E with f(x_i) - (a x_i + b) = sign_i * E. */
function remezStep(xs: number[], signs: number[]): { a: number; b: number; E: number } | null {
    const f = (x: number) => Math.exp(x);
    const M: number[][] = [];
    const rhs: number[] = [];
    for (let i = 0; i < 3; i += 1) {
        const x = xs[i] as number;
        const s = signs[i] as number;
        // a*x + b + s*E = f(x)
        M.push([x, 1, s]);
        rhs.push(f(x));
    }
    const solution = solve3(M, rhs);
    return solution ? { a: solution[0] as number, b: solution[1] as number, E: solution[2] as number } : null;
}

function makeBars(errors: number[], coefficients: number[], active: number): VisualEntity[] {
    const values = [...errors, ...coefficients];
    const labels = [
        "error at left",
        "error at middle",
        "error at right",
        "slope a",
        "intercept b",
        "height E",
    ];
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
    const task = (input as { iterations?: number; tol?: number; initialMiddle?: number } | null) ?? {};
    const iterations = Math.max(1, Math.min(20, Math.floor(Number(task.iterations ?? 8)) || 8));
    const tol = Math.max(1e-14, Number(task.tol ?? 1e-12));
    const left = INTERVAL[0];
    const right = INTERVAL[1];
    let middle = typeof task.initialMiddle === "number"
        ? Math.min(right - 1e-6, Math.max(left + 1e-6, task.initialMiddle))
        : 0.5;
    const signs = [1, -1, 1];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([0, 0, 0], [0, 0, 0], -1),
        edges: [],
        description: `Begin minimax line approximation of exp(x) on [${left}, ${right}] with ${iterations} exchange steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { interval: INTERVAL, iterations, middle },
    };
    step += 1;

    let lastA = 0;
    let lastB = 0;
    let lastE = 0;
    for (let k = 0; k < iterations; k += 1) {
        const xs = [left, middle, right];
        const solution = remezStep(xs, signs);
        if (!solution) {
            yield {
                stepNumber: step,
                entities: makeBars([0, 0, 0], [lastA, lastB, lastE], 2),
                edges: [],
                description: "The reference system was singular; exchange stopped.",
                codeLineNumber: 6,
                layout: "array",
                meta: { converged: false, singular: true, iteration: k + 1 },
            };
            return;
        }
        const { a, b, E } = solution;
        const errors = xs.map((x) => Math.exp(x) - (a * x + b));
        lastA = a;
        lastB = b;
        lastE = E;
        yield {
            stepNumber: step,
            entities: makeBars(errors, [a, b, E], 1),
            edges: [],
            description: `Exchange ${k + 1}: line ${a.toFixed(6)}x + ${b.toFixed(6)}, equioscillation height ${E.toFixed(8)} at x=${middle.toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                a,
                b,
                E,
                reference: xs,
                errors,
                iteration: k + 1,
                middle,
            },
        };
        step += 1;

        // For exp the error derivative is exp(x) - a, so the new interior
        // extremum solves exp(x) = a, namely x = ln(a).
        const nextMiddle = a > 0 ? Math.log(a) : middle;
        const clamped = Math.min(right - 1e-9, Math.max(left + 1e-9, nextMiddle));
        const moved = Math.abs(clamped - middle);
        middle = clamped;
        if (moved < tol) {
            break;
        }
    }

    const xs = [left, middle, right];
    const finalErrors = xs.map((x) => Math.exp(x) - (lastA * x + lastB));
    let gridMax = 0;
    for (let i = 0; i <= 2000; i += 1) {
        const x = left + (i / 2000) * (right - left);
        gridMax = Math.max(gridMax, Math.abs(Math.exp(x) - (lastA * x + lastB)));
    }
    yield {
        stepNumber: step,
        entities: makeBars(finalErrors, [lastA, lastB, lastE], -1),
        edges: [],
        description: `Minimax line ${lastA.toFixed(6)}x + ${lastB.toFixed(6)} has error height ${lastE.toFixed(8)}; grid maximum ${gridMax.toFixed(8)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            a: lastA,
            b: lastB,
            E: lastE,
            middle,
            errors: finalErrors,
            gridMax,
            converged: Math.abs(gridMax - lastE) < 1e-6,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The best approximating line does not merely touch the curve; it alternates above and below it with the same vertical distance at several points. Remez exploits that signature. Given three candidate points, it solves for the line and error height that alternate there, then moves the interior candidate to wherever the new error is largest and repeats.",
        invariants: [
            "The three signed errors at the reference points alternate in sign.",
            "The solved error height E equals the magnitude of each reference error.",
            "For exp the interior extremum always satisfies exp(x) = a, so it stays inside the interval.",
        ],
        correctness:
            "The Chebyshev alternation theorem states that a degree-one polynomial is the unique minimax approximation exactly when its error attains the largest magnitude with alternating signs at three ordered points. Each Remez step enforces those sign and equal-magnitude conditions on the current reference set; exchanging the interior point with the true error extremum moves the reference toward the alternation set. Convergence of the exchange gives the unique minimax line, whose error height matches the maximum error on the whole interval.",
        complexityRationale:
            "Each exchange solves a fixed three by three system and evaluates a logarithm, so the work is O(iterations); only the current reference points and coefficients are retained, giving O(1) space.",
        uses: [
            "Designing minimax finite impulse response filters",
            "Producing numerically efficient function approximations for libraries",
            "Bounding approximation error in polynomial and rational fitting",
        ],
        references: [
            "Cheney, Introduction to Approximation Theory, 2nd edition",
            "Remez, Sur la determination des polynomes d'approximation de degree donne, 1934",
        ],
        workedExample:
            "Approximating exp(x) on [0,1], the exchange converges to a line of slope about 1.72 and intercept about 0.955. The error is about +0.045 at x=0, -0.045 near x=0.54 and +0.045 at x=1, three equal alternating deviations that certify minimax optimality.",
    },
    id: "remez-algorithm",
    name: "Remez Exchange Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { iterations: 8, tol: 1e-12, initialMiddle: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "choose three reference points in increasing order",
        "assign alternating signs plus, minus, plus",
        "solve for slope, intercept and height so errors alternate",
        "record the line and its reference errors",
        "find the interior error extremum by setting the derivative to zero",
        "replace the interior reference point with that extremum",
        "stop when the interior point stops moving",
        "report the minimax line and its error height",
    ],
};

export default module;
