/**
 * common-random-numbers.ts - Common Random Numbers Variance Reduction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * To compare two systems driven by randomness, one can simulate them with
 * independent random streams, which makes the difference of their outputs
 * noisy. Common random numbers instead feed both systems the very same uniform
 * draws through monotone inverse-CDF transforms. The outputs become positively
 * correlated, and the variance of their difference drops by twice the
 * covariance. This module contrasts the paired estimator with an independently
 * paired one on a fixed set of uniforms.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n random draws
 *   Space: O(n) for the per-draw outputs and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per draw shows the system-B output minus the system-A output.
 *   - The final frame reports the paired and unpaired variance estimates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CrnInput {
    uniforms?: number[];
    scaleA?: number;
    scaleB?: number;
}

/** Build one bar per draw showing the paired difference. */
function makeBars(diffs: number[], current: number, done: boolean): VisualEntity[] {
    return diffs.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `draw ${index}: delta ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, difference: value },
        };
    });
}

/** Sample variance with the n-1 denominator, or zero for fewer than two draws. */
function sampleVariance(values: number[]): number {
    const n = values.length;
    if (n < 2) {
        return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / n;
    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
}

/** Compare paired and unpaired estimators built from the same uniforms. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CrnInput | null) ?? {};
    const uniforms: number[] = (task.uniforms ?? [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95]).filter(
        (u) => typeof u === "number" && u > 0 && u < 1,
    );
    const scaleA = typeof task.scaleA === "number" && task.scaleA > 0 ? task.scaleA : 2;
    const scaleB = typeof task.scaleB === "number" && task.scaleB > 0 ? task.scaleB : 1;
    const n = uniforms.length;

    // A monotone transform of each uniform: the exponential quantile.
    const transform = (u: number, scale: number): number => -scale * Math.log(1 - u);
    const a = uniforms.map((u) => transform(u, scaleA));
    const b = uniforms.map((u) => transform(u, scaleB));
    const pairedDiff = a.map((v, i) => v - b[i]!);

    // Break the pairing with a fixed reversal to emulate independent streams.
    const reversed = [...b].reverse();
    const unpairedDiff = a.map((v, i) => v - reversed[i]!);

    const pairedMean = pairedDiff.reduce((acc, v) => acc + v, 0) / (n || 1);
    const unpairedMean = unpairedDiff.reduce((acc, v) => acc + v, 0) / (n || 1);
    const pairedVar = sampleVariance(pairedDiff);
    const unpairedVar = sampleVariance(unpairedDiff);
    const cov = n > 1
        ? a.reduce((acc, v, i) => acc + (v - a.reduce((x, y) => x + y, 0) / n) *
            (b[i]! - b.reduce((x, y) => x + y, 0) / n), 0) / (n - 1)
        : 0;

    yield {
        stepNumber: 0,
        entities: makeBars(pairedDiff, -1, false),
        edges: [],
        description: `Feeding ${n} common uniforms through two monotone transforms to compare variance.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            n,
            scaleA,
            scaleB,
            pairedDiff,
            a,
            b,
            pairedMean,
            unpairedMean,
            pairedVar,
            unpairedVar,
            covariance: cov,
        },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(pairedDiff, i, false),
            edges: [],
            description: `Draw ${i}: system A ${a[i]!.toFixed(3)}, system B ${b[i]!.toFixed(3)}, paired delta ${pairedDiff[i]!.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                n,
                scaleA,
                scaleB,
                pairedDiff,
                a,
                b,
                pairedMean,
                unpairedMean,
                pairedVar,
                unpairedVar,
                covariance: cov,
                revealed: i + 1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pairedDiff, -1, true),
        edges: [],
        description: `Paired variance ${pairedVar.toFixed(4)} versus unpaired ${unpairedVar.toFixed(4)}; covariance ${cov.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            n,
            scaleA,
            scaleB,
            pairedDiff,
            a,
            b,
            pairedMean,
            unpairedMean,
            pairedVar,
            unpairedVar,
            covariance: cov,
        },
    };
}

/** The common random numbers module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Suppose two configurations of a simulation are both driven by random arrivals. Comparing them with independent random streams hides the real difference behind random noise. If instead both see the same sequence of arrivals, a slow configuration is slow on the same hard customers as the fast one, so the difference is much steadier. Sharing random numbers induces a positive correlation that cancels noise in the comparison.",
        invariants: [
            "Both systems receive exactly the same uniform draws in the paired estimator.",
            "The mean paired difference equals the difference of the two sample means.",
            "Paired variance equals the unpaired variance minus twice the output covariance.",
        ],
        correctness:
            "For paired samples the variance of A minus B is Var(A) plus Var(B) minus two Cov(A,B). Because both outputs are increasing functions of the same uniform U, they are positively correlated, so subtracting twice that covariance makes the paired variance smaller than the independent-case variance where the covariance is zero. The two estimators have the same expectation by linearity, so common random numbers reduce variance without introducing bias.",
        complexityRationale:
            "Each draw needs one transform per system and one subtraction, so the run is O(n). Storing the two output arrays and the per-draw differences uses O(n) space.",
        uses: [
            "Comparing two queueing or scheduling policies in simulation",
            "Finite-difference gradient estimates in stochastic optimization",
            "Reducing noise in Monte Carlo A/B comparisons",
        ],
        references: [
            "Glasserman, Monte Carlo Methods in Financial Engineering, Chapter 4",
            "Law, Simulation Modeling and Analysis, Section on variance reduction",
        ],
        workedExample:
            "With uniforms near 0.5 and scales 2 and 1, system A produces roughly twice system B on every draw. Under common random numbers the difference A minus B is nearly constant, so its variance is close to zero, while pairing A with reversed B draws gives a much noisier difference. Both estimates center on the same average gap.",
    },
    id: "common-random-numbers",
    name: "Common Random Numbers",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        uniforms: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95],
        scaleA: 2,
        scaleB: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the common uniform draws and both scale parameters",
        "transform each uniform for system A and system B",
        "form the paired difference for every draw",
        "break the pairing with a fixed reversal for the unpaired estimator",
        "compute both means and both sample variances",
        "report the covariance and the variance reduction",
        "done: the paired estimator has lower variance",
    ],
};

export default module;
