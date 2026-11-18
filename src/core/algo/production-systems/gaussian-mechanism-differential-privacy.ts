/**
 * gaussian-mechanism-differential-privacy.ts - Gaussian Differential Privacy Mechanism
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Gaussian mechanism releases a statistic with added normal noise calibrated
 * to its sensitivity, the largest change the statistic can undergo when one
 * record differs. For a desired epsilon and delta, the standard deviation is
 * set to sensitivity times the square root of two log(1.25/delta), divided by
 * epsilon. The result satisfies (epsilon, delta)-differential privacy: any two
 * neighboring datasets produce outputs whose distributions are nearly
 * indistinguishable. This module releases a bounded mean repeatedly so the
 * noise behavior is visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(releases) normal draws
 *   Space: O(releases) for the plotted releases
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is one noisy release at (index, released value).
 *   - The unbiased true statistic is the center of the cloud of releases.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic mulberry32 pseudo-random generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal draw via Box-Muller. */
function normal(rng: () => number): number {
    return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}

/** Calibrate the Gaussian noise scale for (epsilon, delta)-DP. */
function sigmaFor(sensitivity: number, epsilon: number, delta: number): number {
    return (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
}

/** Build the trace nodes for the releases drawn so far. */
function makeNodes(releases: number[]): VisualEntity[] {
    return releases.map((value, index) => ({
        id: `release-${index}`,
        type: "node" as const,
        label: value.toFixed(3),
        value,
        state: (index === releases.length - 1 ? "sorted" : "unvisited") as EntityState,
        x: index,
        y: value,
        width: 0,
        height: 0,
        metadata: { index, release: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            value?: number;
            sensitivity?: number;
            epsilon?: number;
            delta?: number;
            releases?: number;
            seed?: number;
        } | null) ?? {};
    const value = typeof task.value === "number" ? task.value : 0.6;
    const sensitivity = typeof task.sensitivity === "number" ? Math.max(0, task.sensitivity) : 0.1;
    const epsilon = typeof task.epsilon === "number" ? Math.max(0.01, task.epsilon) : 1;
    const delta =
        typeof task.delta === "number"
            ? Math.max(1e-12, Math.min(0.5, task.delta))
            : 1e-5;
    const releases = typeof task.releases === "number" ? Math.max(1, Math.floor(task.releases)) : 40;
    const rng = makeRng(typeof task.seed === "number" ? Math.floor(task.seed) : 17);
    const sigma = sigmaFor(sensitivity, epsilon, delta);

    const drawn: number[] = [];
    yield {
        stepNumber: 0,
        entities: makeNodes([value]),
        edges: [],
        description: `Calibrated Gaussian noise with sigma ${sigma.toFixed(4)} for epsilon ${epsilon}, delta ${delta}; true value ${value}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { value, sensitivity, epsilon, delta, sigma, releases: 0, noiseMean: 0 },
    };

    let step = 1;
    let noiseSum = 0;
    for (let i = 0; i < releases; i += 1) {
        const noise = sigma * normal(rng);
        noiseSum += noise;
        const released = value + noise;
        drawn.push(released);
        yield {
            stepNumber: step,
            entities: makeNodes(drawn),
            edges: [],
            description: `Release ${i + 1}: added noise ${noise.toFixed(4)} to obtain ${released.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                value,
                sensitivity,
                epsilon,
                delta,
                sigma,
                releases: i + 1,
                noise: noise,
                released,
                noiseMean: noiseSum / (i + 1),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(drawn),
        edges: [],
        description: `${releases} private releases drawn; noise mean ${(noiseSum / releases).toFixed(4)} with standard deviation ${sigma.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            value,
            sensitivity,
            epsilon,
            delta,
            sigma,
            releases,
            noiseMean: noiseSum / releases,
            releasedValues: drawn,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Differential privacy hides whether any single record was in a dataset by adding carefully chosen random noise to a query answer. The Gaussian mechanism draws noise from a normal distribution whose width is set by how much one record can change the answer and by the privacy budget. A smaller epsilon or delta demands more noise, trading answer accuracy for a stronger guarantee.",
        invariants: [
            "The noise scale is proportional to sensitivity and inversely proportional to epsilon.",
            "Each release equals the true statistic plus a fresh zero-mean normal draw.",
            "Neighboring datasets give output distributions within the (epsilon, delta) bound.",
        ],
        correctness:
            "The analytic Gaussian calibration sets sigma to sensitivity times the square root of two log(1.25/delta) over epsilon. With this width, the log likelihood ratio between the outputs of the mechanism on two neighboring datasets is bounded in absolute value by epsilon except on an event of probability at most delta, which is exactly approximate differential privacy. Because adding or removing one record changes the statistic by at most the sensitivity, the shifted Gaussians overlap within that bound, so no observer can reliably infer a single record's presence.",
        complexityRationale:
            "Each release requires one Box-Muller normal draw, a constant number of arithmetic operations, so the run is O(releases). The plotted release values are the only stored data, using O(releases) space.",
        uses: [
            "Publishing privacy-preserving aggregate statistics by statistics agencies",
            "Training machine learning models with formal privacy guarantees",
            "Releasing count and mean queries over sensitive datasets",
        ],
        references: [
            "Dwork, McSherry, Nissim and Smith, Calibrating Noise to Sensitivity in Private Data Analysis, 2006",
            "Dwork and Roth, The Algorithmic Foundations of Differential Privacy, 2014",
        ],
        workedExample:
            "For a bounded mean over ten records the sensitivity is 0.1. With epsilon one and delta one in a hundred thousand, sigma is about 0.1 times the square root of two log(125000), roughly 0.49. A true mean of 0.6 might be released as 0.72 or 0.41; across many releases the noisy values center on 0.6 while hiding any one record.",
    },
    id: "gaussian-mechanism-differential-privacy",
    name: "Gaussian Mechanism (Differential Privacy)",
    category: "production-systems",
    complexity: { time: "O(releases)", space: "O(releases)" },
    defaultInput: {
        value: 0.6,
        sensitivity: 0.1,
        epsilon: 1,
        delta: 0.00001,
        releases: 40,
        seed: 17,
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute the statistic and its L2 sensitivity",
        "calibrate sigma from epsilon and delta",
        "for each requested release",
        "draw a fresh standard normal variate",
        "release the statistic plus sigma times the variate",
        "track the running noise mean",
        "done: report all private releases",
    ],
};

export default module;
