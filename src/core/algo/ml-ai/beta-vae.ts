/**
 * beta-vae.ts - Beta-VAE Disentangled Evidence Lower Bound
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A beta-VAE scales the KL term of the variational autoencoder objective by a
 * factor beta larger than one. For a diagonal Gaussian posterior the KL
 * divergence against a standard normal has the closed form 0.5 times the sum
 * of mu squared plus variance minus one minus log variance. Increasing beta
 * squeezes the approximate posterior toward the prior, encouraging each
 * latent dimension to encode an independent factor of variation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for d latent dimensions
 *   Space: O(d) for the per-dimension KL terms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the mean, variance, and per-dimension KL contributions.
 *   - The final bar is the weighted objective, GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    mu?: number[];
    logvar?: number[];
    recon?: number;
    beta?: number;
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
    const mu = (task.mu ?? [0.5, -1, 0]).slice();
    const logvar = (task.logvar ?? [0, -0.5, 0.7]).slice();
    const n = Math.max(mu.length, logvar.length, 1);
    while (mu.length < n) {
        mu.push(0);
    }
    while (logvar.length < n) {
        logvar.push(0);
    }
    const recon = typeof task.recon === "number" ? task.recon : 2.3;
    const beta = typeof task.beta === "number" ? task.beta : 4;

    const variance = logvar.map((lv) => Math.exp(lv));
    const klTerms = mu.map((m, i) => 0.5 * (m * m + variance[i]! - 1 - logvar[i]!));
    const kl = klTerms.reduce((sum, value) => sum + value, 0);
    const objective = recon + beta * kl;

    yield {
        stepNumber: 0,
        entities: bars(mu, new Array<EntityState>(n).fill("idle")),
        edges: [],
        description: `Read latent means over ${n} dimension(s); beta is ${beta.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mu: mu.slice(), logvar: logvar.slice(), klTerms: klTerms.slice(), kl, recon, beta, objective },
    };

    yield {
        stepNumber: 1,
        entities: bars(variance, new Array<EntityState>(n).fill("comparing")),
        edges: [],
        description: "Variance is exp of the log variance learned by the encoder.",
        codeLineNumber: 1,
        layout: "array",
        meta: { mu: mu.slice(), logvar: logvar.slice(), klTerms: klTerms.slice(), kl, recon, beta, objective },
    };

    yield {
        stepNumber: 2,
        entities: bars(klTerms, new Array<EntityState>(n).fill("active")),
        edges: [],
        description: `Per-dimension KL divergences sum to ${kl.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { mu: mu.slice(), logvar: logvar.slice(), klTerms: klTerms.slice(), kl, recon, beta, objective },
    };

    yield {
        stepNumber: 3,
        entities: bars([objective], ["sorted"]),
        edges: [],
        description: `Weighted objective = reconstruction ${recon.toFixed(3)} + beta ${beta.toFixed(2)} times KL ${kl.toFixed(3)} = ${objective.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { mu: mu.slice(), logvar: logvar.slice(), klTerms: klTerms.slice(), kl, recon, beta, objective },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain variational autoencoder trades reconstruction quality against staying close to a standard normal prior. Beta-VAE turns up the pressure on the prior term, so the model is rewarded for using latent dimensions in a clean, independent way. The larger the beta, the more the representation resembles independent factors, at the cost of some reconstruction error.",
        invariants: [
            "Each per-dimension KL term is nonnegative.",
            "The total KL is the sum of the per-dimension terms.",
            "The objective increases linearly with beta for a fixed posterior and reconstruction.",
        ],
        correctness:
            "For q equal to a normal with mean mu and variance sigma squared and p equal to a standard normal, the KL divergence integral simplifies algebraically to 0.5 times mu squared plus sigma squared minus one minus log sigma squared. Writing the log variance as logvar gives the implemented term directly. Because the objective adds reconstruction plus beta times KL, doubling beta doubles the KL contribution while leaving the reconstruction term unchanged.",
        complexityRationale:
            "Computing each variance and KL term is a constant number of arithmetic operations, so d dimensions take O(d) time. Storing the mean, variance, and KL term arrays uses O(d) space.",
        uses: [
            "Learning disentangled latent factors in unsupervised representation learning",
            "Controllable generation where individual latent dimensions have clear meaning",
            "Fair and interpretable feature discovery in vision and speech",
        ],
        references: [
            "Higgins, Matthey, Pal and others, beta-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework, ICLR 2017",
            "Kingma and Welling, Auto-Encoding Variational Bayes, ICLR 2014",
        ],
        workedExample:
            "With mu of 0.5, log variance 0, reconstruction error 2.3 and beta 4, the first KL term is 0.5 times (0.25 plus 1 minus 1 minus 0), or 0.125. If the other two dimensions contribute 0.1 and 0.25, total KL is 0.475 and the objective is 2.3 plus 4 times 0.475, about 4.2.",
    },
    id: "beta-vae",
    name: "Beta-VAE Objective",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { mu: [0.5, -1, 0], logvar: [0, -0.5, 0.7], recon: 2.3, beta: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the latent means, log variances, reconstruction, and beta",
        "convert each log variance to a variance",
        "compute each KL term from mean and log variance",
        "sum the KL terms into the total KL",
        "form the weighted objective reconstruction plus beta times KL",
        "done: report the objective and the per-dimension terms",
    ],
};

export default module;
