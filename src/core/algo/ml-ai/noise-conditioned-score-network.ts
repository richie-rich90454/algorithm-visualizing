/**
 * noise-conditioned-score-network.ts - Annealed Langevin Dynamics for Score Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A noise-conditioned score network learns the gradient of the log density of
 * data corrupted at many noise levels. Sampling uses annealed Langevin
 * dynamics: start from random noise and, for each noise level from large to
 * small, take steps that move along the estimated score plus random jitter. As
 * the noise level drops the trajectory settles onto the data distribution.
 * This demo uses the exact score of a single Gaussian so the dynamics can be
 * checked against a brute-force reference.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(levels) with one Langevin step per level in this demo
 *   Space: O(levels) for the recorded scores and trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the score and the current sample at each noise level.
 *   - The final frame reports the endpoint error from the data mean.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    x0?: number;
    mu?: number;
    sigmas?: number[];
    stepSize?: number;
    noise?: number[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels?.[index] ?? value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const mu = typeof task.mu === "number" ? task.mu : 1;
    let x = typeof task.x0 === "number" ? task.x0 : -3;
    const sigmas = (task.sigmas ?? [4, 2, 1, 0.5]).slice();
    const stepSize = typeof task.stepSize === "number" ? task.stepSize : 0.1;
    const noise = (task.noise ?? [0.5, -0.5, 0.3, -0.2]).slice();

    const scores: number[] = [];
    const trajectory: number[] = [x];

    yield {
        stepNumber: 0,
        entities: bars([x], ["idle"]),
        edges: [],
        description: `Start sample at ${x.toFixed(3)} with ${sigmas.length} decreasing noise level(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { scores: [], trajectory: trajectory.slice(), sigma: sigmas[0] ?? 1, x, error: Math.abs(x - mu) },
    };

    for (let level = 0; level < sigmas.length; level += 1) {
        const sigma = sigmas[level] ?? 1;
        const safeSigma = Math.abs(sigma) < 1e-6 ? 1e-6 : sigma;
        const score = (mu - x) / (safeSigma * safeSigma);
        const z = noise[level] ?? 0;
        x = x + (stepSize / 2) * score + Math.sqrt(stepSize) * z;
        scores.push(score);
        trajectory.push(x);

        yield {
            stepNumber: level + 1,
            entities: bars([score, x], ["comparing", "active"]),
            edges: [],
            description: `Noise level ${level + 1}, sigma ${sigma.toFixed(2)}: score ${score.toFixed(4)} moves the sample to ${x.toFixed(4)}.`,
            codeLineNumber: level === 0 ? 2 : 3,
            layout: "array",
            meta: { scores: scores.slice(), trajectory: trajectory.slice(), sigma, x, error: Math.abs(x - mu) },
        };
    }

    const error = Math.abs(x - mu);
    yield {
        stepNumber: sigmas.length + 1,
        entities: bars([x, mu], ["sorted", "sorted"]),
        edges: [],
        description: `Endpoint ${x.toFixed(4)} versus data mean ${mu.toFixed(4)}; absolute error ${error.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { scores: scores.slice(), trajectory: trajectory.slice(), sigma: sigmas[sigmas.length - 1] ?? 0, x, error },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Score-based generative models learn which direction in data space increases the likelihood, rather than learning a probability directly. To sample, start from noise and repeatedly walk uphill along that gradient, adding a little fresh noise so the walk can explore. Running the walk first at high noise and then gradually lowering the noise level lets coarse structure form before fine detail, a schedule called annealed Langevin dynamics.",
        invariants: [
            "The score at noise level sigma is (mu minus x) over sigma squared.",
            "Each Langevin step moves half a step size along the score plus scaled noise.",
            "The score always points toward the data mean mu.",
        ],
        correctness:
            "For a Gaussian with mean mu and variance sigma squared, the log density derivative with respect to x is minus (x minus mu) over sigma squared, which equals (mu minus x) over sigma squared. The Langevin update x plus half the step size times the score plus the square root of the step size times standard noise is the discretized stochastic differential equation whose stationary distribution has density proportional to the target. Annealing from large to small sigma first pulls the sample into the broad outline of the distribution and then refines it around the data modes.",
        complexityRationale:
            "Each noise level evaluates one score and one update, so with fixed noise per level the time is O(levels). Storing the score and sample at every level uses O(levels) space.",
        uses: [
            "Score-based generative modeling and image synthesis",
            "Denoising and inverse problems with learned gradients",
            "Sampling from complex unnormalized distributions",
        ],
        references: [
            "Song and Ermon, Generative Modeling by Estimating Gradients of the Data Distribution, NeurIPS 2019",
            "Song, Sohl-Dickstein, Kingma, Kumar, Ermon and Poole, Score-Based Generative Modeling through Stochastic Differential Equations, ICLR 2021",
        ],
        workedExample:
            "Starting at -3 with data mean 1 and sigma 4, the score is (1 minus -3) over 16, or 0.25. With step size 0.1 and noise 0.5, the update moves the sample to about -3 plus 0.0125 plus 0.158, about -2.83. Repeating at smaller sigmas strengthens the pull toward 1, and the final error measures how close the annealed walk landed.",
    },
    id: "noise-conditioned-score-network",
    name: "Noise-Conditioned Score Network",
    category: "ml-ai",
    complexity: { time: "O(levels)", space: "O(levels)" },
    defaultInput: {
        x0: -3,
        mu: 1,
        sigmas: [4, 2, 1, 0.5],
        stepSize: 0.1,
        noise: [0.5, -0.5, 0.3, -0.2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the starting sample, data mean, noise schedule, and step size",
        "for each noise level from large to small",
        "compute the score as mean minus sample over sigma squared",
        "step along the score and add scaled random noise",
        "record the score and the updated sample",
        "done: report the endpoint and its error from the mean",
    ],
};

export default module;
