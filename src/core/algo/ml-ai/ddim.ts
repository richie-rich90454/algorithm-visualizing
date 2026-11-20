/**
 * ddim.ts - Denoising Diffusion Implicit Models Sampling (Deterministic Trajectory)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DDIM generalizes diffusion sampling to a non-Markovian, deterministic process.
 * With eta set to zero, each step predicts a clean signal from the noisy one and
 * then reconstructs the next, less noisy sample using that same predicted noise.
 * Because the noise is fixed across steps, a short subsequence of timesteps can
 * be used, giving fast sampling. With oracle noise the predicted clean signal is
 * exact at every step, so the whole trajectory is verifiable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(timesteps * dimensions) for the elementwise reverse formula
 *   Space: O(dimensions) for the sample and predicted noise
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current sample at each sampling timestep.
 *   - The predicted clean signal of the current step is highlighted.
 *   - Meta records the alpha, sample, clean prediction, and error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DdimInput {
    signal?: number[];
    alphas?: number[];
    seed?: number;
    noise?: number[];
}

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal draw from two uniform samples (Box-Muller). */
function gaussian(random: () => number): number {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `dim-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(3)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, dimension: index },
    }));
}

/** The DDIM deterministic sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DdimInput | null) ?? {};
    const signal = Array.isArray(task.signal) && task.signal.length > 0 ? [...task.signal] : [-2, -1, 0, 1, 2];
    const alphas = Array.isArray(task.alphas) && task.alphas.length >= 2
        ? task.alphas.map((a) => Math.min(1, Math.max(1e-6, a)))
        : [0.04, 0.16, 0.64, 1];
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const random = mulberry32(seed);
    const noise = Array.isArray(task.noise) && task.noise.length === signal.length
        ? [...task.noise]
        : signal.map(() => gaussian(random));

    const sqrt = (a: number) => Math.sqrt(a);
    const sample = signal.map((value, index) => sqrt(alphas[0] ?? 1) * value + sqrt(1 - (alphas[0] ?? 1)) * (noise[index] ?? 0));
    const maxError = (prediction: number[]) => Math.max(...prediction.map((value, index) => Math.abs(value - (signal[index] ?? 0))), 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(sample, "active"),
        edges: [],
        description: `DDIM sampling from ${alphas.length} timesteps on a ${signal.length}-dimensional signal with eta zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, alpha: alphas[0] ?? 1, sample: [...sample], prediction: [...signal], error: 0, eta: 0, timesteps: alphas.length },
    };
    step += 1;

    for (let k = 0; k < alphas.length - 1; k += 1) {
        const aT = alphas[k] ?? 1;
        const aPrev = alphas[k + 1] ?? 1;
        const prediction = sample.map((value, index) => (value - sqrt(1 - aT) * (noise[index] ?? 0)) / sqrt(aT));
        for (let index = 0; index < sample.length; index += 1) {
            sample[index] = sqrt(aPrev) * (prediction[index] ?? 0) + sqrt(1 - aPrev) * (noise[index] ?? 0);
        }
        const error = maxError(prediction);
        yield {
            stepNumber: step,
            entities: makeBars(prediction, "comparing"),
            edges: [],
            description: `Timestep ${k + 1}: alpha ${aT.toFixed(3)}, predicted clean signal error ${error.toExponential(2)} using fixed noise.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step: k + 1, alpha: aT, sample: [...sample], prediction: [...prediction], error, eta: 0, timesteps: alphas.length },
        };
        step += 1;
    }

    const finalError = maxError(sample);
    yield {
        stepNumber: step,
        entities: makeBars(sample, "sorted"),
        edges: [],
        description: `Final DDIM sample matches the clean signal with maximum error ${finalError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step: alphas.length - 1, alpha: alphas[alphas.length - 1] ?? 1, sample: [...sample], prediction: [...sample], error: finalError, eta: 0, timesteps: alphas.length, converged: finalError < 1e-8 },
    };
}

/** The DDIM module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "DDIM changes diffusion sampling from a chain of random steps into a deterministic one. At each timestep it uses the predicted noise to guess the clean signal, then rebuilds the next sample from that guess and the same noise. Because the noise never changes, the process is reproducible and can jump across a short list of timesteps, producing samples in far fewer network evaluations than the original Markovian chain.",
        invariants: [
            "The same predicted noise is used at every timestep of the trajectory.",
            "With eta zero the reverse step is deterministic and adds no fresh randomness.",
            "When the predicted noise is exact, the predicted clean signal equals the original signal.",
        ],
        correctness:
            "The clean-signal estimate is the rearrangement of the forward equation, x0_hat = (x_t minus sqrt(1-alpha_t) times eps) divided by sqrt(alpha_t). The eta-zero DDIM update then sets x_prev = sqrt(alpha_prev) times x0_hat plus sqrt(1-alpha_prev) times eps, which is the deterministic non-Markovian reverse kernel. Substituting the true noise gives x0_hat = x0 exactly, so every step reproduces the forward sample at its alpha and the final sample at alpha one equals the original signal up to floating-point error.",
        complexityRationale:
            "Each timestep applies a constant number of elementwise operations to all dimensions, costing O(dimensions); over the chosen timesteps the time is O(timesteps * dimensions). The sample and noise vectors use O(dimensions) space.",
        uses: [
            "Fast deterministic sampling from diffusion and latent diffusion models",
            "Inversion and interpolation of generated images",
            "A teaching model for non-Markovian diffusion trajectories",
        ],
        references: [
            "Song, Meng, and Ermon, Denoising Diffusion Implicit Models, 2020",
            "Ho, Jain, and Abbeel, Denoising Diffusion Probabilistic Models, 2020",
        ],
        workedExample:
            "With a clean value 2, alphas 0.04 and 1, and noise 0.5, the start sample is sqrt(0.04)*2 + sqrt(0.96)*0.5 about 0.89. Predicting the clean signal gives (0.89 - sqrt(0.96)*0.5)/sqrt(0.04) = 2, and the next sample sqrt(1)*2 + 0 = 2, so the short trajectory recovers the original value exactly.",
    },
    id: "ddim",
    name: "Denoising Diffusion Implicit Models",
    category: "ml-ai",
    complexity: { time: "O(timesteps * dimensions)", space: "O(dimensions)" },
    defaultInput: { signal: [-2, -1, 0, 1, 2], alphas: [0.04, 0.16, 0.64, 1], seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a subsequence of cumulative alphas and draw fixed noise",
        "form the initial noisy sample from the clean signal",
        "for each timestep in the subsequence",
        "predict the clean signal by inverting the forward equation",
        "rebuild the next sample from the prediction and the same noise",
        "record the prediction error at the timestep",
        "done: report the final sample and reconstruction error",
    ],
};

export default module;
