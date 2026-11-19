/**
 * contrastive-divergence.ts - Contrastive Divergence for a Restricted Boltzmann Machine
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Contrastive divergence trains a Restricted Boltzmann Machine without waiting
 * for a full equilibrium sample. Starting from a real visible vector it samples
 * the hidden units, reconstructs the visible units, and samples the hidden units
 * again after a few Gibbs steps. The weight gradient is the outer product of the
 * data-phase activations minus the outer product of the reconstruction-phase
 * activations. A seeded random generator makes the sampling reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * visible * hidden)
 *   Space: O(visible + hidden) for the sampled vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the data vector, the hidden probabilities and samples, the
 *     reconstruction, and the resulting weight gradient.
 *   - The final gradient bar is GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    v?: number[];
    W?: number[];
    hBias?: number[];
    vBias?: number[];
    k?: number;
    seed?: number;
}

type Random = () => number;

/** Small deterministic generator so the sampling replay is reproducible. */
function mulberry32(seed: number): Random {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

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
    const v = (task.v ?? [1, 0]).slice(0, 2);
    while (v.length < 2) {
        v.push(0);
    }
    const W = (task.W ?? [0.8, -0.5, 0.3, 0.6]).slice(0, 4);
    while (W.length < 4) {
        W.push(0);
    }
    const hBias = (task.hBias ?? [0, -0.2]).slice(0, 2);
    while (hBias.length < 2) {
        hBias.push(0);
    }
    const vBias = (task.vBias ?? [0.1, 0]).slice(0, 2);
    while (vBias.length < 2) {
        vBias.push(0);
    }
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : 1;
    const random = mulberry32(typeof task.seed === "number" ? task.seed : 7);

    const pHidden = (visible: number[]): number[] =>
        hBias.map((bias, j) =>
            sigmoid(bias + (W[2 * j] ?? 0) * (visible[0] ?? 0) + (W[2 * j + 1] ?? 0) * (visible[1] ?? 0)),
        );
    const pVisible = (hidden: number[]): number[] =>
        vBias.map((bias, i) =>
            sigmoid(bias + (W[i] ?? 0) * (hidden[0] ?? 0) + (W[2 + i] ?? 0) * (hidden[1] ?? 0)),
        );
    const sample = (probs: number[]): number[] => probs.map((p) => (random() < p ? 1 : 0));

    const dataProb = pHidden(v);
    const dataSample = sample(dataProb);

    yield {
        stepNumber: 0,
        entities: bars(v, ["idle", "idle"]),
        edges: [],
        description: `Data-phase visible vector (${v[0]?.toFixed(2)}, ${v[1]?.toFixed(2)}), ${k} Gibbs step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, dataProb: dataProb.slice(), dataSample: dataSample.slice() },
    };

    yield {
        stepNumber: 1,
        entities: bars(dataProb, ["comparing", "comparing"]),
        edges: [],
        description: `Positive phase hidden probabilities (${dataProb[0]?.toFixed(3)}, ${dataProb[1]?.toFixed(3)}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { k, dataProb: dataProb.slice(), dataSample: dataSample.slice() },
    };

    yield {
        stepNumber: 2,
        entities: bars(dataSample, ["active", "active"]),
        edges: [],
        description: `Sampled positive hidden vector (${dataSample[0]}, ${dataSample[1]}).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { k, dataProb: dataProb.slice(), dataSample: dataSample.slice() },
    };

    let hidden = dataSample.slice();
    let visiblePrime = v.slice();
    let hiddenPrime = hidden.slice();
    for (let step = 0; step < k; step += 1) {
        const pV = pVisible(hidden);
        visiblePrime = sample(pV);
        const pH = pHidden(visiblePrime);
        hiddenPrime = sample(pH);
        hidden = hiddenPrime.slice();
    }

    yield {
        stepNumber: 3,
        entities: bars(visiblePrime, ["comparing", "comparing"]),
        edges: [],
        description: `Reconstructed visible vector (${visiblePrime[0]}, ${visiblePrime[1]}).`,
        codeLineNumber: 3,
        layout: "array",
        meta: { k, dataProb: dataProb.slice(), dataSample: dataSample.slice(), visiblePrime: visiblePrime.slice() },
    };

    yield {
        stepNumber: 4,
        entities: bars(hiddenPrime, ["active", "active"]),
        edges: [],
        description: `Negative phase hidden vector (${hiddenPrime[0]}, ${hiddenPrime[1]}).`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            k,
            dataProb: dataProb.slice(),
            dataSample: dataSample.slice(),
            visiblePrime: visiblePrime.slice(),
            hiddenPrime: hiddenPrime.slice(),
        },
    };

    const deltaW = [
        (v[0] ?? 0) * (dataSample[0] ?? 0) - (visiblePrime[0] ?? 0) * (hiddenPrime[0] ?? 0),
        (v[1] ?? 0) * (dataSample[0] ?? 0) - (visiblePrime[1] ?? 0) * (hiddenPrime[0] ?? 0),
        (v[0] ?? 0) * (dataSample[1] ?? 0) - (visiblePrime[0] ?? 0) * (hiddenPrime[1] ?? 0),
        (v[1] ?? 0) * (dataSample[1] ?? 0) - (visiblePrime[1] ?? 0) * (hiddenPrime[1] ?? 0),
    ];

    yield {
        stepNumber: 5,
        entities: bars(deltaW, ["sorted", "sorted", "sorted", "sorted"]),
        edges: [],
        description: `Weight gradient (positive minus negative outer products) = [${deltaW.map((x) => x.toFixed(2)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            k,
            dataProb: dataProb.slice(),
            dataSample: dataSample.slice(),
            visiblePrime: visiblePrime.slice(),
            hiddenPrime: hiddenPrime.slice(),
            deltaW,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Training a Boltzmann machine would be easy if we could sample from its equilibrium distribution, but that is expensive. Contrastive divergence takes a shortcut: start a short Markov chain at the real data, let it run only a few Gibbs steps, and use where it ended up as a stand-in for a perfect negative sample. The weight update pushes up the probability of the data and pushes down the probability of the reconstruction.",
        invariants: [
            "Hidden units are independent of each other given the visible units, and vice versa.",
            "The positive phase always starts from the observed data vector.",
            "The gradient is the data outer product minus the reconstruction outer product.",
        ],
        correctness:
            "For a Restricted Boltzmann Machine the conditional probability of each hidden unit is a logistic function of its bias plus the weighted sum of the visible units, and the visible conditional has the symmetric form. Sampling these conditionals alternates the two Gibbs steps. The log-likelihood gradient equals the expectation of the data outer product minus the expectation under the model distribution; truncating the chain after k steps gives the contrastive divergence estimator, which is biased but cheap and works well in practice.",
        complexityRationale:
            "Each Gibbs step computes two conditional probability vectors, each costing hidden times visible operations, so k steps cost O(k times visible times hidden). Storing the probability and sample vectors for both layers uses O(visible plus hidden) space.",
        uses: [
            "Training shallow generative models of binary data",
            "Collaborative filtering and recommendation systems",
            "A historical foundation for modern energy-based models",
        ],
        references: [
            "Hinton, Training Products of Experts by Minimizing Contrastive Divergence, Neural Computation 2002",
            "Ackley, Hinton and Sejnowski, A Learning Algorithm for Boltzmann Machines, Cognitive Science 1985",
        ],
        workedExample:
            "With visible vector (1, 0), weights [0.8, -0.5, 0.3, 0.6], and hidden bias (0, -0.2), the first hidden probability is sigmoid(0.8), about 0.69, and the second is sigmoid(-0.2), about 0.45. After one Gibbs step the reconstruction and its hidden sample give a negative outer product. Subtracting it from the data outer product yields the four weight gradients.",
    },
    id: "contrastive-divergence",
    name: "Contrastive Divergence (RBM)",
    category: "ml-ai",
    complexity: { time: "O(k * visible * hidden)", space: "O(visible + hidden)" },
    defaultInput: {
        v: [1, 0],
        W: [0.8, -0.5, 0.3, 0.6],
        hBias: [0, -0.2],
        vBias: [0.1, 0],
        k: 1,
        seed: 7,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the data vector, weights, biases, and step count",
        "compute hidden probabilities from the visible data",
        "sample the positive hidden vector",
        "for k steps reconstruct the visible vector and resample hidden units",
        "form the data outer product",
        "subtract the reconstruction outer product to get the gradient",
        "done: report the weight gradient",
    ],
};

export default module;
