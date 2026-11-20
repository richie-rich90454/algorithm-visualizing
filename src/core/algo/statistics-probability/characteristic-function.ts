/**
 * characteristic-function.ts - Characteristic Function of a Discrete Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The characteristic function of a random variable X is phi(t) = E[e^(itX)].
 * For a discrete distribution it sums p times cosine(t x) into the real part
 * and p times sine(t x) into the imaginary part. Unlike the moment generating
 * function it is defined for every real t, its modulus never exceeds one, and
 * its derivatives at zero encode the moments of the distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * outcomes) to evaluate the curve
 *   Space: O(steps) for the plotted real and imaginary values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars per grid point show the real and imaginary parts of phi(t).
 *   - Bars fill in left to right as the weighted sinusoids are summed.
 *   - The final frame reports phi(0) and the modulus bound.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CharacteristicInput {
    values?: number[];
    probabilities?: number[];
    tMin?: number;
    tMax?: number;
    steps?: number;
}

/** Build a real and an imaginary bar for every grid point. */
function makeBars(
    ts: number[],
    real: Array<number | null>,
    imaginary: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < ts.length; i += 1) {
        const t = ts[i] ?? 0;
        for (const part of ["real", "imaginary"] as const) {
            const value = part === "real" ? real[i] : imaginary[i];
            let state: EntityState = "idle";
            if (done || i < current) {
                state = "sorted";
            } else if (i === current) {
                state = "comparing";
            }
            entities.push({
                id: `${part}-${i}`,
                type: "bar" as const,
                label: `${part === "real" ? "Re" : "Im"} phi(${t.toFixed(2)}) = ${(value ?? 0).toFixed(3)}`,
                value: value ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: i, part, t, value: value ?? 0 },
            });
        }
    }
    return entities;
}

/** The characteristic function generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CharacteristicInput | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? [...task.values] : [0, 1];
    const rawProbabilities: number[] = Array.isArray(task.probabilities)
        ? [...task.probabilities]
        : [0.4, 0.6];
    const probabilitySum = rawProbabilities.reduce((a, b) => a + b, 0);
    const probabilities = probabilitySum === 0
        ? rawProbabilities.map(() => 1 / rawProbabilities.length)
        : rawProbabilities.map((p) => p / probabilitySum);
    const tMin = typeof task.tMin === "number" ? task.tMin : -3;
    const tMax = typeof task.tMax === "number" ? task.tMax : 3;
    const steps = Math.max(2, Math.floor(task.steps ?? 9));
    const ts = Array.from({ length: steps }, (_, i) => tMin + ((tMax - tMin) * i) / (steps - 1));
    const mean = values.reduce((sum, x, i) => sum + x * (probabilities[i] ?? 0), 0);

    const unknownReal: Array<number | null> = new Array<number | null>(steps).fill(null);
    const unknownImaginary: Array<number | null> = new Array<number | null>(steps).fill(null);
    yield {
        stepNumber: 0,
        entities: makeBars(ts, unknownReal, unknownImaginary, -1, false),
        edges: [],
        description: `Evaluating phi(t) for ${values.length} outcome(s) over ${steps} grid points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { steps, ts, real: [] as number[], imaginary: [] as number[], magnitude: [] as number[], mean },
    };
    let step = 1;

    const real: number[] = [];
    const imaginary: number[] = [];
    const magnitude: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        const t = ts[i] ?? 0;
        let re = 0;
        let im = 0;
        for (let k = 0; k < values.length; k += 1) {
            const angle = t * (values[k] ?? 0);
            re += (probabilities[k] ?? 0) * Math.cos(angle);
            im += (probabilities[k] ?? 0) * Math.sin(angle);
        }
        real.push(re);
        imaginary.push(im);
        magnitude.push(Math.hypot(re, im));
        const shownReal = [...real, ...new Array<number | null>(steps - real.length).fill(null)];
        const shownImaginary = [
            ...imaginary,
            ...new Array<number | null>(steps - imaginary.length).fill(null),
        ];
        yield {
            stepNumber: step,
            entities: makeBars(ts, shownReal, shownImaginary, i, false),
            edges: [],
            description: `At t=${t.toFixed(3)}: Re phi=${re.toFixed(6)}, Im phi=${im.toFixed(6)}, modulus ${Math.hypot(re, im).toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { steps, ts, real: [...real], imaginary: [...imaginary], magnitude: [...magnitude], mean },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(ts, real, imaginary, -1, true),
        edges: [],
        description: `phi(0)=${real[0]?.toFixed(6)} and the largest modulus is ${Math.max(...magnitude).toFixed(6)}, never above one.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { steps, ts, real, imaginary, magnitude, mean, modulusBound: Math.max(...magnitude) },
    };
}

/** The characteristic function module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The characteristic function packages a distribution into a curve on the real line by averaging a rotating complex exponential. At each t the real part is a weighted sum of cosines and the imaginary part is a weighted sum of sines. Because the exponential always has modulus one, the average can never leave the unit disk, and the curve at zero is always one.",
        invariants: [
            "phi(0) equals one because the probabilities sum to one.",
            "The modulus of phi(t) is at most one for every real t.",
            "The real part is even and the imaginary part is odd when the distribution is real valued.",
        ],
        correctness:
            "Euler's formula splits e raised to i t x into cosine(t x) plus i sine(t x), and linearity of expectation turns the average into the weighted sums the module computes. Setting t to zero makes every cosine one and every sine zero, giving phi(0) equal to one. The triangle inequality applied to a convex combination of unit-modulus exponentials gives the modulus bound. Expanding the exponential in a Taylor series shows the k-th derivative at zero equals i to the k times the k-th raw moment.",
        complexityRationale:
            "Each of the steps grid points visits every outcome once, so evaluation takes O(steps times outcomes) time. Storing one real and one imaginary value per grid point uses O(steps) space; the moments need only constant extra work.",
        uses: [
            "Proving the central limit theorem with Fourier methods",
            "Reconstructing distributions from their transforms",
            "Testing goodness of fit with the empirical characteristic function",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Chapter 2",
            "Lukacs, Characteristic Functions, 2nd edition, 1970",
        ],
        workedExample:
            "For a Bernoulli variable that is one with probability 0.6, phi(t) equals 0.4 plus 0.6 times cosine(t) plus i times 0.6 sine(t). At zero this is 1, at pi it is 0.4 minus 0.6 which is minus 0.2, and the modulus stays at most one across the whole grid.",
    },
    id: "characteristic-function",
    name: "Characteristic Function",
    category: "statistics-probability",
    complexity: { time: "O(steps * outcomes)", space: "O(steps)" },
    defaultInput: {
        values: [0, 1],
        probabilities: [0.4, 0.6],
        tMin: -3,
        tMax: 3,
        steps: 9,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the outcomes, their probabilities, and the t grid",
        "normalize the probabilities so they sum to one",
        "for each grid point start a real and an imaginary accumulator at zero",
        "add probability times cosine of t times x to the real part",
        "add probability times sine of t times x to the imaginary part",
        "store the pair as the complex value phi at that t",
        "check that phi at zero is one and the modulus never exceeds one",
        "done: report the real and imaginary curve over t",
    ],
};

export default module;
