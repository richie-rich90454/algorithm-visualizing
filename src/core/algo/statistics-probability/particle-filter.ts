/**
 * particle-filter.ts - Sequential Importance Resampling Particle Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A particle filter approximates a posterior distribution with a cloud of
 * weighted samples. Each step predicts the particles forward through a process
 * model, reweights them by how likely the latest observation is under each
 * particle, and resamples so that high-weight particles are copied and
 * low-weight ones disappear. The weighted mean is the state estimate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * particles)
 *   Space: O(particles) for the positions and weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each particle is a node placed at (position index, state position).
 *   - The estimated mean is reported in the frame metadata.
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

/** Build one node per particle. */
function makeNodes(positions: number[], weights: number[], active: number): VisualEntity[] {
    return positions.map((position, index) => ({
        id: `particle-${index}`,
        type: "node" as const,
        label: position.toFixed(2),
        value: position,
        state: (index === active ? "comparing" : "visited") as EntityState,
        x: index,
        y: position,
        width: 0,
        height: 0,
        metadata: { index, weight: weights[index] ?? 0, position },
    }));
}

/** The particle filter generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            particles?: number;
            observations?: number[];
            processNoise?: number;
            obsVar?: number;
            seed?: number;
        } | null
    ) ?? {};
    const count = typeof task.particles === "number" ? Math.max(1, Math.floor(task.particles)) : 20;
    const observations = Array.isArray(task.observations) && task.observations.length > 0
        ? task.observations.map(Number)
        : [0.5, 1.2, 0.3, 1.8, 1.1];
    const processNoise = typeof task.processNoise === "number" ? Math.max(0, task.processNoise) : 0.5;
    const obsVar = typeof task.obsVar === "number" ? Math.max(1e-6, task.obsVar) : 0.5;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const rng = makeRng(seed);

    let positions = Array.from({ length: count }, (_, i) =>
        count === 1 ? 0 : -2 + (4 * i) / (count - 1));
    let weights = new Array<number>(count).fill(1 / count);

    yield {
        stepNumber: 0,
        entities: makeNodes(positions, weights, -1),
        edges: [],
        description: `Initialized ${count} particles spread over the state space.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { steps: observations.length, particles: count, estimate: 0, ess: count },
    };
    let step = 1;

    for (let t = 0; t < observations.length; t += 1) {
        const observation = observations[t] as number;

        // Predict: move each particle by symmetric process noise.
        for (let i = 0; i < count; i += 1) {
            positions[i] = (positions[i] as number) + (2 * rng() - 1) * processNoise;
        }

        // Update: weight by observation likelihood and normalize.
        let total = 0;
        const likelihoods = positions.map((position) => {
            const likelihood = Math.exp(-((observation - position) ** 2) / (2 * obsVar));
            total += likelihood;
            return likelihood;
        });
        weights = total > 0 ? likelihoods.map((l) => l / total) : new Array<number>(count).fill(1 / count);

        const estimate = positions.reduce((acc, p, i) => acc + p * (weights[i] as number), 0);
        const ess = 1 / weights.reduce((acc, w) => acc + w * w, 0);

        // Resample: multinomial draw from the cumulative weight distribution.
        const cumulative: number[] = [];
        let running = 0;
        for (let i = 0; i < count; i += 1) {
            running += weights[i] as number;
            cumulative.push(running);
        }
        const resampled: number[] = [];
        for (let i = 0; i < count; i += 1) {
            const u = rng();
            let chosen = count - 1;
            for (let j = 0; j < count; j += 1) {
                if (u <= (cumulative[j] as number)) {
                    chosen = j;
                    break;
                }
            }
            resampled.push(positions[chosen] as number);
        }
        positions = resampled;
        weights = new Array<number>(count).fill(1 / count);

        yield {
            stepNumber: step,
            entities: makeNodes(positions, weights, t % count),
            edges: [],
            description: `Step ${t + 1}: observation ${observation}, estimate ${estimate.toFixed(4)}, effective sample size ${ess.toFixed(2)} of ${count}.`,
            codeLineNumber: t === 0 ? 1 : t === 1 ? 3 : t === 2 ? 4 : 5,
            layout: "point",
            meta: { steps: observations.length, particles: count, observation, estimate, ess },
        };
        step += 1;
    }

    const finalEstimate = positions.reduce((a, b) => a + b, 0) / count;
    yield {
        stepNumber: step,
        entities: makeNodes(positions, weights, -1),
        edges: [],
        description: `Filter finished after ${observations.length} observation(s); final particle mean ${finalEstimate.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { steps: observations.length, particles: count, estimate: finalEstimate, ess: count },
    };
}

/** The particle filter module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Represent a belief about the state by a cloud of possible states called particles. Move each particle according to how the state evolves, then give particles near the new observation more weight and resample to discard unlikely ones. After a few rounds the cloud concentrates where the real state probably is.",
        invariants: [
            "Weights are nonnegative and sum to one after the update.",
            "Resampling copies particles without changing their state values.",
            "The effective sample size lies between one and the number of particles.",
        ],
        correctness:
            "Importance sampling reweights particles by the ratio of the target density to the proposal density, so the weighted cloud approximates the posterior. Multinomial resampling draws new particles with probability equal to their weights, which is unbiased and leaves the weighted empirical distribution unchanged in expectation. Repeating predict and update applies Bayes' rule recursively, so the cloud converges to the filtering distribution as the particle count grows.",
        complexityRationale:
            "Each timestep predicts, weights, and resamples every particle once, so time is O(steps times particles). Only the current positions and weights are stored, giving O(particles) space.",
        uses: [
            "State estimation for robots and self-driving vehicles",
            "Tracking objects from noisy sensor readings",
            "Nonlinear filtering in finance and weather models",
        ],
        references: [
            "Doucet, de Freitas, and Gordon, Sequential Monte Carlo Methods in Practice, 2001",
            "Gordon, Salmond, and Smith, A Novel Approach to Nonlinear Non-Gaussian Bayesian State Estimation, 1993",
        ],
        workedExample:
            "With two particles at zero and two at one and an observation near one, the particle at one gets a much larger likelihood. After normalization and resampling, most copies sit near one, so the weighted mean moves toward the observed value.",
    },
    id: "particle-filter",
    name: "Particle Filter",
    category: "statistics-probability",
    complexity: { time: "O(steps * particles)", space: "O(particles)" },
    defaultInput: {
        particles: 20,
        observations: [0.5, 1.2, 0.3, 1.8, 1.1],
        processNoise: 0.5,
        obsVar: 0.5,
        seed: 7,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize particles and uniform weights",
        "for each observation",
        "predict each particle through the process model",
        "weight particles by observation likelihood and normalize",
        "compute the weighted mean and effective sample size",
        "resample particles proportionally to their weights",
        "done: report the filter estimate and final cloud",
    ],
};

export default module;
