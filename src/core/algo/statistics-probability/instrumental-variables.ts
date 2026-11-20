/**
 * instrumental-variables.ts - Instrumental Variables Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When a regressor is correlated with the error term, ordinary least squares
 * is biased and inconsistent. If an instrument z is correlated with the
 * endogenous regressor x but uncorrelated with the error, the instrumental
 * variables estimator recovers the causal slope. In the just identified case
 * with one instrument and one regressor it is the ratio of the sample
 * covariance between z and y to that between z and x. The module accumulates
 * those cross products observation by observation and contrasts the IV slope
 * with the OLS slope and the two first-stage ratios.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) over n observations
 *   Space: O(n) for the displayed observation bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows the outcome value.
 *   - The current observation is highlighted while cross products accrue.
 *   - The final frame reports the IV slope, the OLS slope, and identification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface InstrumentalInput {
    x?: number[];
    z?: number[];
    y?: number[];
}

/** Build one outcome bar per observation. */
function makeBars(y: number[], current: number, done: boolean): VisualEntity[] {
    return y.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `obs ${index + 1}: y=${value.toFixed(2)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, outcome: value },
        };
    });
}

/** The instrumental variables generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as InstrumentalInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) ? task.x.map((v) => Number(v)) : [1, 2, 3, 4, 5];
    const z: number[] = Array.isArray(task.z) ? task.z.map((v) => Number(v)) : [1, 1, 2, 2, 3];
    const y: number[] = Array.isArray(task.y) ? task.y.map((v) => Number(v)) : [2.1, 4.2, 5.8, 8.1, 10.2];
    const n = Math.min(x.length, z.length, y.length);
    const values = { x: x.slice(0, n), z: z.slice(0, n), y: y.slice(0, n) };

    let sumZX = 0;
    let sumZY = 0;
    let sumZZ = 0;
    let sumXX = 0;
    let sumXY = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(values.y, -1, false),
        edges: [],
        description: `Estimating a causal slope from ${n} observation(s) with one endogenous regressor and one instrument.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, sumZX: 0, sumZY: 0, sumZZ: 0, sumXX: 0, sumXY: 0, betaIV: 0, betaOLS: 0, firstStage: 0, reducedForm: 0, identified: false },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const xi = values.x[i] ?? 0;
        const zi = values.z[i] ?? 0;
        const yi = values.y[i] ?? 0;
        sumZX += zi * xi;
        sumZY += zi * yi;
        sumZZ += zi * zi;
        sumXX += xi * xi;
        sumXY += xi * yi;
        yield {
            stepNumber: step,
            entities: makeBars(values.y, i, false),
            edges: [],
            description: `Observation ${i + 1}: x=${xi.toFixed(2)}, z=${zi.toFixed(2)}, y=${yi.toFixed(2)}; cross products z*x=${sumZX.toFixed(3)}, z*y=${sumZY.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, sumZX, sumZY, sumZZ, sumXX, sumXY, betaIV: 0, betaOLS: 0, firstStage: 0, reducedForm: 0, identified: false, current: i },
        };
        step += 1;
    }

    const identified = Math.abs(sumZX) > 1e-12 && Math.abs(sumZZ) > 1e-12 && Math.abs(sumXX) > 1e-12;
    const betaIV = identified ? sumZY / sumZX : 0;
    const betaOLS = Math.abs(sumXX) > 1e-12 ? sumXY / sumXX : 0;
    const firstStage = Math.abs(sumZZ) > 1e-12 ? sumZX / sumZZ : 0;
    const reducedForm = Math.abs(sumZZ) > 1e-12 ? sumZY / sumZZ : 0;
    yield {
        stepNumber: step,
        entities: makeBars(values.y, -1, true),
        edges: [],
        description: identified
            ? `IV slope ${betaIV.toFixed(4)} versus OLS slope ${betaOLS.toFixed(4)}; first stage ${firstStage.toFixed(4)}, reduced form ${reducedForm.toFixed(4)}.`
            : `The instrument is not correlated with the regressor; the IV slope is not identified.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, sumZX, sumZY, sumZZ, sumXX, sumXY, betaIV, betaOLS, firstStage, reducedForm, identified },
    };
}

/** The instrumental variables module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary regression mistakes correlation for causation when the regressor moves together with hidden causes of the outcome. An instrument is a variable that nudges the regressor but has no direct route to the outcome. Dividing the instrument's effect on the outcome by its effect on the regressor strips out the confounding and leaves the causal slope.",
        invariants: [
            "The IV slope equals the reduced form coefficient divided by the first stage coefficient.",
            "The first stage coefficient is the sample covariance of z and x divided by the variance of z.",
            "When the instrument is uncorrelated with x the model is not identified and no IV slope is reported.",
        ],
        correctness:
            "Write the outcome as beta times x plus an error. Multiplying by z and averaging gives covariance of z and y equals beta times covariance of z and x plus covariance of z and the error. The instrument exogeneity assumption makes that last covariance zero in the population, so beta equals the ratio of covariances. The sample cross products are consistent estimates of those covariances, so the ratio converges to the causal slope. OLS instead uses covariance of x and y over variance of x, which retains the correlation between x and the error and is therefore biased.",
        complexityRationale:
            "Each observation contributes five products to running totals, so estimation takes O(n) time. Only the outcome bars are stored for display and a fixed number of accumulators, giving O(n) space overall.",
        uses: [
            "Estimating returns to education using compulsory schooling laws",
            "Demand estimation with cost shifters as instruments",
            "Correcting attenuation bias from measurement error",
        ],
        references: [
            "Wright, Tariff on Animal and Vegetable Oils, 1928",
            "Wooldridge, Introductory Econometrics, Chapter 15",
        ],
        workedExample:
            "Suppose an instrument shifts the regressor by two units on average and shifts the outcome by six units. The first stage coefficient is two and the reduced form coefficient is six, so the IV slope is three. An OLS fit may report a different slope because the regressor also moves with omitted factors that affect the outcome.",
    },
    id: "instrumental-variables",
    name: "Instrumental Variables",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        x: [1, 2, 3, 4, 5],
        z: [1, 1, 2, 2, 3],
        y: [2.1, 4.2, 5.8, 8.1, 10.2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read matched arrays for the regressor, instrument, and outcome",
        "initialize the cross-product accumulators to zero",
        "for each observation add z times x and z times y",
        "also add z squared, x squared, and x times y",
        "set the IV slope to the ratio of z times y over z times x",
        "set the OLS slope to x times y over x squared",
        "done: report both slopes, the first stage, and identification",
    ],
};

export default module;
