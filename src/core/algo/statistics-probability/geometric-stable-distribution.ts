/**
 * geometric-stable-distribution.ts - Geometric Stable Characteristic Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A geometric stable law is the limiting distribution of a geometrically
 * random number of independent heavy-tailed summands. It is specified most
 * cleanly by its characteristic function, an exponential whose exponent is a
 * stable-type power modulated by a skewness parameter. This module evaluates
 * that characteristic function on a frequency grid, exposing its modulus,
 * real part, and imaginary part. Setting the shape to two recovers a Gaussian
 * characteristic function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points)
 *   Space: O(points) for the three characteristic-function curves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per frequency shows the modulus of the characteristic function.
 *   - The real and imaginary parts are overlaid in the frame metadata.
 *   - The final frame reports the modulus at unit frequency.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface CfValue {
    modulus: number;
    re: number;
    im: number;
}

/** Characteristic function of a geometric stable law at frequency t. */
function cfAt(t: number, alpha: number, beta: number, scale: number): CfValue {
    if (t === 0) return { modulus: 1, re: 1, im: 0 };
    const magnitude = Math.pow(scale * Math.abs(t), alpha);
    const modulus = Math.exp(-magnitude);
    let angle: number;
    if (Math.abs(alpha - 1) < 1e-9) {
        angle = -beta * Math.sign(t) * (2 / Math.PI) * Math.log(Math.abs(t)) * (scale * Math.abs(t));
    } else {
        angle = -beta * Math.sign(t) * Math.tan((Math.PI * alpha) / 2) * magnitude;
    }
    return { modulus, re: modulus * Math.cos(angle), im: modulus * Math.sin(angle) };
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, modulus: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alpha?: number; beta?: number; scale?: number; points?: number } | null) ?? {};
    const alpha = typeof task.alpha === "number" ? Math.max(0.2, Math.min(2, task.alpha)) : 1.4;
    const beta = typeof task.beta === "number" ? Math.max(-1, Math.min(1, task.beta)) : 0.3;
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number"
        ? Math.max(5, Math.min(200, Math.floor(task.points))) : 61;
    const tMax = 6;
    const ts = Array.from({ length: points }, (_, i) => -tMax + (2 * tMax * i) / (points - 1));
    const values = ts.map((t) => cfAt(t, alpha, beta, scale));
    const moduli = values.map((v) => v.modulus);
    const reals = values.map((v) => v.re);
    const imags = values.map((v) => v.im);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points).fill(0), -1, false),
        edges: [],
        description: `Evaluating the geometric stable characteristic function with alpha ${alpha}, beta ${beta}, scale ${scale}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { alpha, beta, scale, points, ts, moduli: [], re: [], im: [], complete: false },
    };
    let step = 1;
    for (let i = 0; i < ts.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(moduli.slice(0, i + 1).concat(new Array<number>(points - i - 1).fill(0)), i, false),
            edges: [],
            description: `At frequency ${(ts[i] as number).toFixed(3)} the modulus is ${moduli[i]!.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                alpha, beta, scale, points, ts,
                moduli: moduli.slice(0, i + 1), re: reals.slice(0, i + 1), im: imags.slice(0, i + 1),
                complete: false,
            },
        };
        step += 1;
    }

    const atOne = cfAt(1, alpha, beta, scale);
    yield {
        stepNumber: step,
        entities: makeBars(moduli, points, true),
        edges: [],
        description: `Curve complete: modulus at frequency one is ${atOne.modulus.toFixed(6)}, real part ${atOne.re.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            alpha, beta, scale, points, ts, moduli, re: reals, im: imags,
            atOne: { modulus: atOne.modulus, re: atOne.re, im: atOne.im }, complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A geometric stable law arises when you add a random, geometrically distributed number of heavy-tailed variables. Its characteristic function has a simple closed form: an exponential of a power of the frequency, with skewness twisting the complex phase. We draw that function directly rather than trying to write down a density.",
        invariants: [
            "The characteristic function equals one at frequency zero.",
            "Its modulus never exceeds one and equals exp(-(scale times absolute t) raised to alpha).",
            "For zero skewness the imaginary part vanishes and the real part is even.",
        ],
        correctness:
            "The geometric stable family is defined by the characteristic function exp(-(scale times absolute t)^alpha times (1 minus i beta sign(t) tan(pi alpha / 2))) for alpha not equal to one, with a logarithmic variant at alpha one. At t zero the exponent vanishes so the function is one. The modulus is the exponential of the real part of the exponent, which is exactly exp(-(scale absolute t)^alpha), hence at most one. When beta is zero the phase angle is zero, leaving a real, even function.",
        complexityRationale:
            "Each frequency needs a constant amount of arithmetic: one power, one tangent, and one sine and cosine. Evaluating the whole grid is O(points) time and O(points) space.",
        uses: [
            "Modeling heavy-tailed financial returns with geometric compounding",
            "Analyzing random sums in risk and teletraffic models",
            "Providing a limiting law for geometric stable noise",
        ],
        references: [
            "Samorodnitsky and Taqqu, Stable Non-Gaussian Random Processes, 1994",
            "Kozubowski and Rachev, Geometric Stable Distributions, 1994",
        ],
        workedExample:
            "With alpha two, beta zero, and scale one, the modulus at frequency one is exp(-1), about 0.368, and the imaginary part is zero, matching a standard normal characteristic function. With alpha one point four the modulus decays more slowly at small frequencies, reflecting the heavier tails of a geometric stable law.",
    },
    id: "geometric-stable-distribution",
    name: "Geometric Stable Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { alpha: 1.4, beta: 0.3, scale: 1, points: 61 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape alpha, skewness beta, and scale",
        "build a symmetric grid of frequencies t",
        "if t is zero return characteristic value one",
        "set magnitude to (scale times absolute t) raised to alpha",
        "set modulus to exp(-magnitude)",
        "set phase from beta and the sign of t",
        "set real part to modulus cos(phase) and imaginary to modulus sin(phase)",
        "done: report modulus, real, and imaginary curves",
    ],
};

export default module;
