/**
 * euler-ancestral-sampler.ts - Euler Ancestral Diffusion Sampler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Euler ancestral sampler reverses a variance-preserving diffusion
 * process one noise level at a time. At each step it predicts a clean sample
 * from the noisy one using the estimated noise, then walks back to the
 * previous noise level by mixing that prediction with the same noise. With a
 * perfect noise estimate it inverts the forward diffusion exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * d) for T steps and sample width d
 *   Space: O(T * d) for the sampling trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sample vector as it is denoised step by step, from the
 *     noisiest state back to the clean output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamplerInput {
    alphaBars?: number[];
    xT?: number[];
    noise?: number[];
}

/** Forward variance-preserving diffusion of a clean sample at a given level. */
export function forwardDiffuse(x0: number[], alpha: number, noise: number[]): number[] {
    const sa = Math.sqrt(alpha);
    const s1a = Math.sqrt(Math.max(0, 1 - alpha));
    return x0.map((value, i) => sa * value + s1a * (noise[i] ?? 0));
}

/** One Euler ancestral reverse step from level t to level t-1. */
export function ancestralStep(
    x: number[],
    alphaCurrent: number,
    alphaPrevious: number,
    noise: number[],
): number[] {
    const saCur = Math.sqrt(alphaCurrent);
    const s1aCur = Math.sqrt(Math.max(0, 1 - alphaCurrent));
    const saPrev = Math.sqrt(alphaPrevious);
    const s1aPrev = Math.sqrt(Math.max(0, 1 - alphaPrevious));
    return x.map((value, i) => {
        const predictedX0 = (value - s1aCur * (noise[i] ?? 0)) / saCur;
        return saPrev * predictedX0 + s1aPrev * (noise[i] ?? 0);
    });
}

/** Run the full reverse chain from the last noise level down to zero. */
export function ancestralSample(
    xT: number[],
    alphaBars: number[],
    noise: number[],
): number[][] {
    const trajectory: number[][] = [xT];
    let x = xT;
    for (let t = alphaBars.length - 1; t > 0; t -= 1) {
        x = ancestralStep(x, alphaBars[t] ?? 1, alphaBars[t - 1] ?? 1, noise);
        trajectory.push(x);
    }
    return trajectory;
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SamplerInput | null) ?? {};
    const alphaBars: number[] = task.alphaBars ?? [1, 0.64, 0.36, 0.16];
    const xT: number[] = task.xT ?? forwardDiffuse([2, -1], 0.16, [0.4, -0.3]);
    const noise: number[] = task.noise ?? [0.4, -0.3];
    const trajectory = ancestralSample(xT, alphaBars, noise);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(xT, xT.map(() => "unvisited")),
        edges: [],
        description: `Start from the noisiest sample at alpha ${(alphaBars[alphaBars.length - 1] ?? 0).toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", alphas: alphaBars, trajectory: [xT], current: xT },
    };
    step += 1;

    for (let i = 1; i < trajectory.length; i += 1) {
        const current = trajectory[i] ?? [];
        yield {
            stepNumber: step,
            entities: bars(current, current.map((_v, index) => index === 0 ? "active" : "comparing")),
            edges: [],
            description: `Reverse step ${i}: predict the clean sample and mix with noise to reach alpha ${(alphaBars[alphaBars.length - 1 - i] ?? 0).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "step", alphas: alphaBars, trajectory: trajectory.slice(0, i + 1), current },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(trajectory[trajectory.length - 1] ?? [], (trajectory[trajectory.length - 1] ?? []).map(() => "sorted")),
        edges: [],
        description: `Done: reached the clean sample at alpha ${(alphaBars[0] ?? 1).toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", alphas: alphaBars, trajectory, current: trajectory[trajectory.length - 1] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Diffusion models corrupt data with Gaussian noise and learn to reverse that corruption. The Euler ancestral sampler walks backward through the noise schedule: it subtracts the estimated noise to guess the clean sample, then re-adds the right amount of noise for the previous level. Repeating this from pure noise produces a clean sample.",
        invariants: [
            "At each level the forward process is x = sqrt(alpha) times x0 plus sqrt(1-alpha) times noise.",
            "The predicted clean sample divides the residual noise by sqrt(alpha).",
            "With the true noise the reverse chain exactly inverts the forward process.",
        ],
        correctness:
            "The forward process at level t is x_t = sqrt(alpha_t) x0 + sqrt(1-alpha_t) noise, so solving for x0 gives (x_t minus sqrt(1-alpha_t) noise) divided by sqrt(alpha_t). Substituting that prediction into the forward formula at level t-1 gives x_{t-1} = sqrt(alpha_{t-1}) predictedX0 + sqrt(1-alpha_{t-1}) noise, which is exactly the ancestral update. When the noise passed to the sampler equals the noise used in the forward pass, the predicted x0 is the original sample and every reverse step lands precisely on the earlier forward state, so the chain recovers x0 exactly.",
        complexityRationale:
            "Each of the T reverse steps touches each of the d coordinates a constant number of times, giving O(T d) time. Saving every intermediate sample for playback uses O(T d) space.",
        uses: [
            "Sampling images from diffusion and score-based generative models",
            "Ancestral sampling where each step injects fresh noise",
            "Deterministic inversion and reconstruction experiments",
        ],
        references: [
            "Song, Meng and Ermon, Denoising Diffusion Implicit Models, ICLR 2021",
            "Ho, Jain and Abbeel, Denoising Diffusion Probabilistic Models, NeurIPS 2020",
        ],
        workedExample:
            "Clean sample (2, -1) with noise (0.4, -0.3) at alpha 0.16 gives x = 0.4 times the sample plus about 0.9165 times the noise. Running the sampler from that noisy value with the same noise predicts the clean sample back and, after the full schedule, returns (2, -1) exactly.",
    },
    id: "euler-ancestral-sampler",
    name: "Euler Ancestral Sampler",
    category: "ml-ai",
    complexity: { time: "O(T d)", space: "O(T d)" },
    defaultInput: {
        alphaBars: [1, 0.64, 0.36, 0.16],
        xT: [1.1398, -0.6249],
        noise: [0.4, -0.3],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the alpha schedule, noisy sample and noise estimate",
        "start from the last and noisiest alpha level",
        "predict the clean sample by removing scaled noise",
        "mix the prediction with noise at the previous level",
        "repeat until reaching the cleanest level",
        "done: report the denoised sample",
    ],
};

export default module;
