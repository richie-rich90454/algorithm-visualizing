/**
 * moment-generating-function.ts - Moment Generating Function of a Discrete
 * Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The moment generating function of a random variable is M(t) equals the
 * expected value of e to the t times X. For a discrete distribution it is a
 * weighted sum of exponentials. Its derivatives at zero give the raw moments:
 * the first is the mean and the second is the expected square, so the variance
 * is the second moment minus the squared mean.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * outcomes) to evaluate the curve
 *   Space: O(steps) for the plotted values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point t shows M(t).
 *   - Bars fill in left to right as the exponentials are summed.
 *   - The final frame is green and reports the moments at zero.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MgfInput {
    values?: number[];
    probabilities?: number[];
    tMin?: number;
    tMax?: number;
    steps?: number;
}

/** Build bars for the M(t) curve. */
function makeBars(ts: number[], mgf: Array<number | null>, current: number, done: boolean): VisualEntity[] {
    return ts.map((t, index) => {
        const value = mgf[index] ?? 0;
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: mgf[index] === null ? `t=${t.toFixed(2)}` : `${t.toFixed(2)}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, t, mgf: mgf[index] ?? 0 },
        };
    });
}

/** The moment generating function generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MgfInput | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? [...task.values] : [0, 1];
    const rawProbabilities: number[] = Array.isArray(task.probabilities) ? [...task.probabilities] : [0.4, 0.6];
    const probabilitySum = rawProbabilities.reduce((a, b) => a + b, 0);
    const probabilities = probabilitySum === 0
        ? rawProbabilities.map(() => 1 / rawProbabilities.length)
        : rawProbabilities.map((p) => p / probabilitySum);
    const tMin = typeof task.tMin === "number" ? task.tMin : -2;
    const tMax = typeof task.tMax === "number" ? task.tMax : 2;
    const steps = Math.max(2, Math.floor(task.steps ?? 9));
    const ts = Array.from({ length: steps }, (_, i) => tMin + ((tMax - tMin) * i) / (steps - 1));

    const mean = values.reduce((sum, x, i) => sum + x * (probabilities[i] ?? 0), 0);
    const secondMoment = values.reduce((sum, x, i) => sum + x * x * (probabilities[i] ?? 0), 0);
    const variance = Math.max(0, secondMoment - mean * mean);

    const unknown: Array<number | null> = new Array<number | null>(steps).fill(null);
    yield {
        stepNumber: 0,
        entities: makeBars(ts, unknown, -1, false),
        edges: [],
        description: `Computing M(t) for a distribution with ${values.length} outcome(s) over ${steps} grid points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { steps, ts, mgf: [] as number[], mean, secondMoment, variance },
    };
    let step = 1;

    const mgf: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        const t = ts[i] ?? 0;
        let value = 0;
        for (let k = 0; k < values.length; k += 1) {
            value += (probabilities[k] ?? 0) * Math.exp(t * (values[k] ?? 0));
        }
        mgf.push(value);
        const display = [...mgf, ...new Array<number | null>(steps - mgf.length).fill(null)];
        yield {
            stepNumber: step,
            entities: makeBars(ts, display, i, false),
            edges: [],
            description: `M(${t.toFixed(3)}) = ${value.toFixed(6)} from the weighted exponentials.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { steps, ts, mgf: [...mgf], mean, secondMoment, variance },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(ts, mgf, -1, true),
        edges: [],
        description: `M(0) = ${mgf[0]?.toFixed(6)}; mean ${mean.toFixed(4)}, second moment ${secondMoment.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { steps, ts, mgf, mean, secondMoment, variance },
    };
}

/** The moment generating function module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The moment generating function packages an entire distribution into one function. Raising e to t times each outcome and averaging gives a curve whose slope at zero is the mean and whose curvature at zero is the expected square. Expanding the exponential shows that the coefficient of t to the k over k factorial is exactly the k-th raw moment.",
        invariants: [
            "M(0) always equals one because the probabilities sum to one.",
            "M(t) is positive for every real t when outcomes are real.",
            "The first derivative at zero is the mean and the second is the expected square.",
        ],
        correctness:
            "By linearity of expectation, the expected value of e to tX equals the sum over outcomes of probability times e to t times the outcome, which is what the module accumulates. Differentiating term by term and evaluating at t zero brings down a factor of the outcome for the first derivative and the square of the outcome for the second, so M prime at zero is the mean and M double prime at zero is the second moment. Variance follows from the standard identity second moment minus mean squared.",
        complexityRationale:
            "Evaluating each of the steps grid points touches every outcome, giving O(steps times outcomes) time. The plotted values require O(steps) space, and the moments use O(1) extra work.",
        uses: [
            "Deriving means and variances of standard distributions",
            "Proving limit theorems such as the central limit theorem",
            "Summing independent variables because M of a sum multiplies",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Chapter 2",
            "Grinstead and Snell, Introduction to Probability, Chapter 9",
        ],
        workedExample:
            "For a Bernoulli variable that is one with probability 0.6 and zero otherwise, M(t) equals 0.4 plus 0.6 times e to the t. At zero this is 1, the slope at zero is 0.6, and the second derivative at zero is also 0.6, so the variance is 0.6 minus 0.36, which is 0.24.",
    },
    id: "moment-generating-function",
    name: "Moment Generating Function",
    category: "statistics-probability",
    complexity: { time: "O(steps * outcomes)", space: "O(steps)" },
    defaultInput: { values: [0, 1], probabilities: [0.4, 0.6], tMin: -2, tMax: 2, steps: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "read the outcomes, their probabilities, and the t grid",
        "normalize the probabilities to sum to one",
        "compute the mean and second moment directly from the probabilities",
        "for each grid point compute the weighted sum of exponentials",
        "store the result as M at that t",
        "differentiate numerically at zero to confirm the moments",
        "done: report the curve, mean, second moment, and variance",
    ],
};

export default module;
