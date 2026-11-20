/**
 * variational-autoencoder.ts - Variational Autoencoder Forward Pass and ELBO
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A variational autoencoder maps an input to a Gaussian distribution over a
 * latent code, samples from that distribution with the reparameterization
 * trick, and decodes the sample back to the data space. The evidence lower
 * bound is the negative reconstruction error minus the KL divergence between
 * the approximate posterior and a standard normal prior. This demo uses a
 * linear encoder and decoder so every quantity can be checked by hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for input dimension d and a scalar latent
 *   Space: O(d) for the reconstruction
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input, the latent mean, the sampled code, and the output.
 *   - The final frame reports reconstruction, KL, and the ELBO.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    x?: number[];
    wMu?: number[];
    bMu?: number;
    wLog?: number[];
    bLog?: number;
    wDec?: number[];
    bDec?: number[];
    epsilon?: number[];
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
    const x = (task.x ?? [1, 2, -1]).slice();
    const d = Math.max(x.length, 1);
    const at = (a: number[] | undefined, i: number, fallback: number): number => a?.[i] ?? fallback;
    const wMu = task.wMu ?? [0.5, -0.2, 0.3];
    const wLog = task.wLog ?? [0.1, 0.05, -0.1];
    const wDec = task.wDec ?? [0.8, -0.6, 0.4];
    const bDec = task.bDec ?? [0, 0, 0];
    const bMu = typeof task.bMu === "number" ? task.bMu : 0.1;
    const bLog = typeof task.bLog === "number" ? task.bLog : 0;
    const eps = at(task.epsilon, 0, 0.5);

    let mu = bMu;
    let logvar = bLog;
    for (let i = 0; i < d; i += 1) {
        mu += at(wMu, i, 0) * (x[i] ?? 0);
        logvar += at(wLog, i, 0) * (x[i] ?? 0);
    }
    const z = mu + Math.exp(0.5 * logvar) * eps;
    const xHat = x.map((_, i) => at(wDec, i, 0) * z + at(bDec, i, 0));
    const recon = x.reduce((sum, value, i) => sum + (value - (xHat[i] ?? 0)) ** 2, 0);
    const kl = 0.5 * (mu * mu + Math.exp(logvar) - 1 - logvar);
    const elbo = -recon - kl;

    yield {
        stepNumber: 0,
        entities: bars(x, new Array<EntityState>(d).fill("idle")),
        edges: [],
        description: `Encode input of dimension ${d} into a scalar Gaussian latent code.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mu, logvar, z, xHat: xHat.slice(), recon, kl, elbo },
    };

    yield {
        stepNumber: 1,
        entities: bars([mu, logvar], ["comparing", "comparing"]),
        edges: [],
        description: `Encoder predicts mean ${mu.toFixed(3)} and log variance ${logvar.toFixed(3)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { mu, logvar, z, xHat: xHat.slice(), recon, kl, elbo },
    };

    yield {
        stepNumber: 2,
        entities: bars([z], ["active"]),
        edges: [],
        description: `Reparameterized sample z = ${z.toFixed(3)} from mu plus sigma times epsilon.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { mu, logvar, z, xHat: xHat.slice(), recon, kl, elbo },
    };

    yield {
        stepNumber: 3,
        entities: bars(xHat, new Array<EntityState>(d).fill("comparing")),
        edges: [],
        description: `Decoder reconstructs (${xHat.map((v) => v.toFixed(3)).join(", ")}).`,
        codeLineNumber: 3,
        layout: "array",
        meta: { mu, logvar, z, xHat: xHat.slice(), recon, kl, elbo },
    };

    yield {
        stepNumber: 4,
        entities: bars([recon, kl, -elbo], ["active", "active", "sorted"]),
        edges: [],
        description: `ELBO = -${recon.toFixed(3)} reconstruction minus ${kl.toFixed(3)} KL = ${elbo.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { mu, logvar, z, xHat: xHat.slice(), recon, kl, elbo },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An autoencoder learns to copy its input through a small bottleneck. The variational version makes the bottleneck a distribution instead of a fixed vector, so nearby points decode to similar outputs and the model can generate new samples. Sampling is done with the reparameterization trick, which keeps the random draw separate from the learned mean and variance so gradients can still flow.",
        invariants: [
            "The latent mean and log variance depend only on the input and encoder weights.",
            "The sampled code equals the mean plus the standard deviation times the fixed noise.",
            "The ELBO is the negative reconstruction error minus the KL divergence.",
        ],
        correctness:
            "The encoder linear forms produce mu and logvar; the reparameterization z equals mu plus exp of half the logvar times epsilon, which has mean mu and variance exp of logvar when epsilon is standard normal. The decoder is linear, so the reconstruction and its squared error are exact. For a diagonal Gaussian posterior against a standard normal prior the KL integral reduces to 0.5 times mu squared plus variance minus one minus log variance. Combining these gives the ELBO identity maximized during training.",
        complexityRationale:
            "The encoder forms two dot products over d inputs and the decoder forms d outputs from the scalar code, all linear in d. Computing the reconstruction and KL is also linear, so the whole pass is O(d) in time and O(d) in space for the reconstructed vector.",
        uses: [
            "Generative modeling of images, text, and audio",
            "Dimensionality reduction and learning smooth latent spaces",
            "Semi-supervised learning and anomaly detection",
        ],
        references: [
            "Kingma and Welling, Auto-Encoding Variational Bayes, ICLR 2014",
            "Rezende, Mohamed and Wierstra, Stochastic Backpropagation, ICML 2014",
        ],
        workedExample:
            "For input (1, 2, -1) with encoder weights (0.5, -0.2, 0.3) and bias 0.1, the latent mean is about 1.2. With log variance near 0.06 and epsilon 0.5, the sample is about 1.72. A linear decoder maps it back to a three-dimensional reconstruction, and the ELBO subtracts the squared reconstruction error and the small KL penalty.",
    },
    id: "variational-autoencoder",
    name: "Variational Autoencoder (VAE)",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: {
        x: [1, 2, -1],
        wMu: [0.5, -0.2, 0.3],
        bMu: 0.1,
        wLog: [0.1, 0.05, -0.1],
        bLog: 0,
        wDec: [0.8, -0.6, 0.4],
        bDec: [0, 0, 0],
        epsilon: [0.5],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the input and the encoder and decoder weights",
        "compute the latent mean and log variance",
        "sample the latent code by reparameterization",
        "decode the sample back to the input space",
        "measure squared reconstruction error",
        "compute the KL divergence to the standard normal",
        "done: report the ELBO as negative reconstruction minus KL",
    ],
};

export default module;
