/**
 * ddpm.ts - Denoising Diffusion Probabilistic Models (full forward and reverse)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DDPM corrupts a clean signal over T variance-preserving steps using a fixed
 * beta schedule, then learns to predict the added noise. The simplified
 * training loss is the mean squared error between the true and predicted noise.
 * Sampling runs the Markovian reverse chain: at each step it estimates the
 * clean signal from the predicted noise and forms the posterior mean toward a
 * less noisy sample. With oracle noise predictions every clean-signal estimate
 * is exact, so the whole trajectory is verifiable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T d) for T steps on a d-dimensional signal
 *   Space: O(T d) for the reported trajectory and noise tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the clean signal, each noised sample, and each reverse mean.
 *   - The current timestep's vector is highlighted.
 *   - Meta records the alpha schedule, every sample, and the training loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DdpmInput {
    x0?: number[];
    betas?: number[];
    eps?: number[][];
    epsHat?: number[][];
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: `d${index}=${value.toFixed(3)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function flatten(rows: number[][]): number[] {
    return rows.reduce<number[]>((acc, row) => acc.concat(row), []);
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DdpmInput | null) ?? {};
    const x0 = (task.x0 ?? [-2, -0.5, 0.5, 2]).slice();
    const betas = (task.betas ?? [0.02, 0.05, 0.1, 0.2]).map((b) =>
        Math.min(0.999, Math.max(1e-6, b)),
    );
    const T = betas.length;
    const d = x0.length;
    const eps: number[][] = Array.isArray(task.eps) && task.eps.length === T
        ? task.eps.map((row) => [...row])
        : Array.from({ length: T }, (_, t) =>
              Array.from({ length: d }, (_, j) => 0.4 * Math.sin(1.7 * (t + 1) + 0.9 * (j + 1))),
          );
    const epsHat: number[][] = Array.isArray(task.epsHat) && task.epsHat.length === T
        ? task.epsHat.map((row) => [...row])
        : eps.map((row) => [...row]);

    const alpha = betas.map((b) => 1 - b);
    const alphaBar: number[] = [];
    let cumulative = 1;
    for (let t = 0; t < T; t += 1) {
        cumulative *= alpha[t] ?? 0;
        alphaBar.push(cumulative);
    }

    const forward: number[][] = [];
    const x0hat: number[][] = [];
    const losses: number[] = [];
    for (let t = 0; t < T; t += 1) {
        const sqrtBar = Math.sqrt(alphaBar[t] ?? 0);
        const sqrtOneMinusBar = Math.sqrt(Math.max(0, 1 - (alphaBar[t] ?? 0)));
        forward.push(
            x0.map((v, j) => sqrtBar * v + sqrtOneMinusBar * (eps[t]?.[j] ?? 0)),
        );
        x0hat.push(
            (forward[t] ?? []).map((v, j) =>
                sqrtBar > 1e-12
                    ? (v - sqrtOneMinusBar * (epsHat[t]?.[j] ?? 0)) / sqrtBar
                    : 0,
            ),
        );
        losses.push(
            mean((eps[t] ?? []).map((v, j) => (v - (epsHat[t]?.[j] ?? 0)) ** 2)),
        );
    }

    const reverse: number[][] = [];
    for (let t = T - 1; t >= 0; t -= 1) {
        const xt = forward[t] ?? [];
        const sqrtAlpha = Math.sqrt(alpha[t] ?? 0);
        const sqrtOneMinusBar = Math.sqrt(Math.max(0, 1 - (alphaBar[t] ?? 0)));
        const prevBar = t === 0 ? 1 : (alphaBar[t - 1] ?? 0);
        const coefX0 = (Math.sqrt(prevBar) * (betas[t] ?? 0)) / Math.max(1e-12, 1 - (alphaBar[t] ?? 0));
        const coefXt = (sqrtAlpha * (1 - prevBar)) / Math.max(1e-12, 1 - (alphaBar[t] ?? 0));
        reverse.push(
            xt.map((v, j) => coefX0 * (x0hat[t]?.[j] ?? 0) + coefXt * v),
        );
    }
    reverse.reverse();

    const totalLoss = mean(losses);
    const finalError = forward.length > 0
        ? Math.sqrt(mean((x0hat[forward.length - 1] ?? []).map((v, j) => (v - (x0[j] ?? 0)) ** 2)))
        : 0;

    const commonMeta = {
        T,
        d,
        betas,
        alpha,
        alphaBar,
        x0,
        eps: flatten(eps),
        epsHat: flatten(epsHat),
        forward: flatten(forward),
        x0hat: flatten(x0hat),
        reverse: flatten(reverse),
        losses,
        totalLoss,
        finalError,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x0, "sorted", "x0"),
        edges: [],
        description: `DDPM with ${T} variance-preserving steps on a ${d}-dimensional clean signal.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, t: -1 },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        yield {
            stepNumber: step,
            entities: bars(forward[t] ?? [], "active", "xt"),
            edges: [],
            description: `Forward step ${t + 1}: alpha-bar ${(alphaBar[t] ?? 0).toFixed(4)}; noise estimate MSE ${(losses[t] ?? 0).toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...commonMeta, t, x0hatStep: x0hat[t] ?? [] },
        };
        step += 1;
    }

    for (let k = 0; k < reverse.length; k += 1) {
        const t = T - 1 - k;
        yield {
            stepNumber: step,
            entities: bars(reverse[k] ?? [], "comparing", "prev"),
            edges: [],
            description: `Reverse step from t=${t + 1}: form the posterior mean toward a less noisy sample.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...commonMeta, t, reverseStep: reverse[k] ?? [] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(x0hat[x0hat.length - 1] ?? [], "sorted", "x0hat"),
        edges: [],
        description: `Done: noise-prediction loss ${totalLoss.toFixed(6)}, clean-signal reconstruction error ${finalError.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...commonMeta, t: T, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Diffusion models destroy a data point by adding a little Gaussian noise many times, then learn to reverse that destruction. DDPM makes each forward step a simple scaling of the original signal plus scaling of Gaussian noise, so after many steps the result looks like pure noise. Training teaches a network to guess the noise that was added; sampling repeatedly removes a predicted noise contribution to walk back toward clean data.",
        invariants: [
            "alpha-bar at step t is the product of alphas from zero through t and decreases with t.",
            "The forward sample is sqrt(alpha-bar) times the clean signal plus sqrt(one minus alpha-bar) times Gaussian noise.",
            "With oracle noise predictions the clean-signal estimate equals the original signal exactly.",
        ],
        correctness:
            "The variance-preserving forward kernel gives x_t = sqrt(alpha-bar_t) x0 plus sqrt(one minus alpha-bar_t) epsilon, which follows by composing the single-step Gaussians. Inverting that equation with a noise prediction yields x0-hat; when the prediction is the true noise the algebra is exact. The DDPM reverse posterior mean is a weighted combination of x0-hat and x_t with weights derived from the forward variances. The test recomputes alpha-bar, every forward sample, the simplified noise-prediction loss, and every posterior mean independently.",
        complexityRationale:
            "Each of the T steps touches each of the d signal dimensions a constant number of times, so time is O(T d). Reporting the trajectory and both noise tables uses O(T d) space.",
        uses: [
            "High-fidelity image and audio generation",
            "Denoising and inpainting with a learned prior",
            "A foundation for classifier-free guidance and latent diffusion",
        ],
        references: [
            "Ho, Jain, and Abbeel, Denoising Diffusion Probabilistic Models, NeurIPS 2020",
            "Sohl-Dickstein et al., Deep Unsupervised Learning using Nonequilibrium Thermodynamics, 2015",
        ],
        workedExample:
            "With betas 0.02, 0.05, 0.1, 0.2 the cumulative alpha-bar values are about 0.98, 0.93, 0.84, and 0.67. At the last step a clean component of 2 becomes roughly 1.64 plus 0.57 times its noise component, and dividing the noisy value minus 0.57 times the true noise by 0.82 recovers 2 exactly.",
    },
    id: "ddpm",
    name: "Denoising Diffusion Probabilistic Models",
    category: "ml-ai",
    complexity: { time: "O(T d)", space: "O(T d)" },
    defaultInput: {
        x0: [-2, -0.5, 0.5, 2],
        betas: [0.02, 0.05, 0.1, 0.2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the clean signal, beta schedule, and noise predictions",
        "compute alpha as one minus beta and alpha-bar as their running product",
        "for each step form the noisy sample from the clean signal and noise",
        "estimate the clean signal by inverting the forward equation",
        "average the squared noise-prediction errors as the training loss",
        "for each reverse step compute the posterior mean toward a cleaner sample",
        "done: report the loss and clean-signal reconstruction error",
    ],
};

export default module;
