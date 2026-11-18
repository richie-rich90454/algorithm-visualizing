/**
 * denoising-diffusion-step.ts - One Denoising Diffusion Forward and Reverse Step
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a toy, single-step variance-preserving diffusion demo. The forward
 * step corrupts a clean signal with Gaussian noise scaled by alpha. The reverse
 * step uses the known noise as an oracle to estimate the clean signal again by
 * inverting the forward formula exactly. It illustrates the core algebra of a
 * DDPM denoising step without claiming to be a full trained diffusion model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for a d-dimensional signal
 *   Space: O(d) for the noisy and reconstructed signals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the clean signal, sampled noise, noisy signal, and reconstruction.
 *   - The final frame reports the maximum reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal sample from two uniform draws (Box-Muller). */
function gaussian(random: () => number): number {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeEntities(values: number[], label: string, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `dim-${index}`,
        type: "bar" as const,
        label: `${label} ${value.toFixed(2)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, series: label },
    }));
}

/** The one-step diffusion generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { signal?: number[]; alpha?: number; seed?: number } | null
    ) ?? {};
    const signal: number[] = task.signal ?? [-2, -1, 0, 1, 2, 3];
    const alpha = typeof task.alpha === "number" ? Math.min(0.999, Math.max(0.001, task.alpha)) : 0.8;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 17;
    const random = mulberry32(seed);
    const sqrtAlpha = Math.sqrt(alpha);
    const sqrtNoise = Math.sqrt(1 - alpha);

    const noise = signal.map(() => gaussian(random));
    const noisy = signal.map((value, index) => sqrtAlpha * value + sqrtNoise * noise[index]!);
    const reconstructed = noisy.map(
        (value, index) => (value - sqrtNoise * noise[index]!) / sqrtAlpha,
    );
    const maxError = Math.max(
        ...reconstructed.map((value, index) => Math.abs(value - signal[index]!)),
        0,
    );

    const baseMeta = {
        alpha,
        seed,
        sqrtAlpha: Number(sqrtAlpha.toFixed(6)),
        sqrtNoise: Number(sqrtNoise.toFixed(6)),
    };

    yield {
        stepNumber: 0,
        entities: makeEntities(signal, "x0", "sorted"),
        edges: [],
        description: `Clean signal of length ${signal.length}; one variance-preserving diffusion step with alpha ${alpha.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, maxError: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeEntities(noise, "eps", "comparing"),
        edges: [],
        description: `Sampled standard Gaussian noise with seed ${seed}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta, noise: noise.map((value) => Number(value.toFixed(6))), maxError: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeEntities(noisy, "xt", "active"),
        edges: [],
        description: `Forward step: xt = sqrt(alpha) * x0 + sqrt(1-alpha) * eps.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            ...baseMeta,
            noisy: noisy.map((value) => Number(value.toFixed(6))),
            maxError: 0,
        },
    };

    yield {
        stepNumber: 3,
        entities: makeEntities(reconstructed, "x0hat", "path"),
        edges: [],
        description: `Reverse step with the oracle noise recovers x0 from xt by inverting the forward formula.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            ...baseMeta,
            reconstructed: reconstructed.map((value) => Number(value.toFixed(6))),
            maxError,
        },
    };

    yield {
        stepNumber: 4,
        entities: makeEntities(reconstructed, "x0hat", "sorted"),
        edges: [],
        description: `Maximum absolute reconstruction error is ${maxError.toExponential(2)}; the single denoising step is exact.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...baseMeta, maxError, converged: maxError < 1e-9 },
    };
}

/** The toy diffusion-step module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Diffusion models destroy a signal by adding noise in small steps and learn to reverse that damage. This toy shows one variance-preserving step in each direction. If the noise that was added is known, subtracting it and dividing by the square root of alpha recovers the clean signal exactly, which is the algebraic heart of a denoising sample.",
        invariants: [
            "The noisy value is sqrt(alpha) times the clean value plus sqrt(1-alpha) times Gaussian noise.",
            "The reconstruction uses the identical noise and the inverse scale 1/sqrt(alpha).",
            "With exact noise the reconstruction error is only floating-point rounding.",
        ],
        correctness:
            "Substituting xt into the reverse formula gives ((sqrt(alpha) x0 + sqrt(1-alpha) eps) - sqrt(1-alpha) eps) / sqrt(alpha) = x0. The cancellation is algebraic, so for any alpha in (0,1) and any noise vector the denoised estimate equals the original signal up to floating-point error.",
        complexityRationale:
            "Generating one Gaussian per dimension and applying two linear combinations costs O(d) time and O(d) space, where d is the signal length.",
        uses: [
            "Illustrating the forward and reverse equations of DDPM sampling",
            "Teaching why a noise predictor implies a denoising step",
            "A sanity check for implementing variance-preserving schedules",
        ],
        references: [
            "Ho, Jain, and Abbeel, Denoising Diffusion Probabilistic Models, 2020",
            "Song and Ermon, Generative Modeling by Estimating Gradients, 2019",
        ],
        workedExample:
            "For a clean value 2, alpha 0.8, and noise 0.5, the forward value is sqrt(0.8)*2 + sqrt(0.2)*0.5 about 1.890. The reverse step subtracts sqrt(0.2)*0.5 and divides by sqrt(0.8), returning 2 exactly.",
    },
    id: "denoising-diffusion-step",
    name: "Denoising Diffusion Step",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { signal: [-2, -1, 0, 1, 2, 3], alpha: 0.8, seed: 17 },
    visualType: "array",
    run,
    pseudocode: [
        "draw one standard Gaussian noise value per dimension",
        "compute noisy value as sqrt(alpha) times clean plus sqrt(1-alpha) times noise",
        "reverse: subtract sqrt(1-alpha) times the noise from the noisy value",
        "divide the result by sqrt(alpha) to estimate the clean value",
        "compare the estimate with the original signal",
        "done: report the maximum reconstruction error",
    ],
};

export default module;
