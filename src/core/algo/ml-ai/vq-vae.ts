/**
 * vq-vae.ts - Vector Quantized Variational Autoencoder Codebook Lookup
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A VQ-VAE replaces the continuous latent sample of a standard autoencoder with
 * a discrete code: the encoder output is snapped to the nearest vector in a
 * learned codebook. The straight-through estimator copies gradients to the
 * encoder, and a commitment loss keeps encoder outputs close to their codes so
 * the codebook does not thrash. This module visualizes the quantization step
 * and the commitment objective.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * d) to scan K codes of dimension d
 *   Space: O(K) for the distance list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the squared distance from the encoder output to each code.
 *   - The nearest code turns GREEN and the selected codebook vector is shown.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    zE?: number[];
    codebook?: number[][];
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
    const zE = (task.zE ?? [1.1, -0.2]).slice(0, 2);
    while (zE.length < 2) {
        zE.push(0);
    }
    const codebook = (task.codebook ?? [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
    ]).map((code) => code.slice(0, 2));
    const beta = typeof task.beta === "number" ? task.beta : 0.25;

    const distances = codebook.map((code) => {
        const c0 = code[0] ?? 0;
        const c1 = code[1] ?? 0;
        return (zE[0]! - c0) ** 2 + (zE[1]! - c1) ** 2;
    });

    yield {
        stepNumber: 0,
        entities: bars(zE, ["idle", "idle"]),
        edges: [],
        description: `Encoder output (${zE[0]?.toFixed(3)}, ${zE[1]?.toFixed(3)}) is compared against ${codebook.length} codebook vectors.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { zE: zE.slice(), distances: distances.slice(), nearest: -1 },
    };

    yield {
        stepNumber: 1,
        entities: bars(distances, new Array<EntityState>(codebook.length).fill("comparing")),
        edges: [],
        description: "Squared Euclidean distance to every codebook entry.",
        codeLineNumber: 1,
        layout: "array",
        meta: { zE: zE.slice(), distances: distances.slice(), nearest: -1 },
    };

    let nearest = 0;
    for (let k = 1; k < distances.length; k += 1) {
        if ((distances[k] ?? Infinity) < (distances[nearest] ?? Infinity)) {
            nearest = k;
        }
    }
    const states: EntityState[] = new Array<EntityState>(codebook.length).fill("idle");
    states[nearest] = "sorted";
    const zQ = (codebook[nearest] ?? [0, 0]).slice(0, 2);

    yield {
        stepNumber: 2,
        entities: bars(distances, states),
        edges: [],
        description: `Code ${nearest} is nearest with squared distance ${(distances[nearest] ?? 0).toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { zE: zE.slice(), distances: distances.slice(), nearest, zQ: zQ.slice() },
    };

    const commitmentLoss = (1 + beta) * (distances[nearest] ?? 0);

    yield {
        stepNumber: 3,
        entities: bars(zQ, ["sorted", "sorted"]),
        edges: [],
        description: `Quantized vector (${zQ[0]?.toFixed(3)}, ${zQ[1]?.toFixed(3)}); commitment loss ${commitmentLoss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            zE: zE.slice(),
            distances: distances.slice(),
            nearest,
            zQ: zQ.slice(),
            commitmentLoss,
            beta,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of letting the latent code be any point in a continuous space, force it to be one of a finite set of prototype vectors. The encoder produces a candidate point and the codebook snaps it to the closest prototype. A commitment term stops the encoder from constantly changing which prototype it aims at, which would otherwise make the discrete codes unstable.",
        invariants: [
            "The selected code is always the codebook entry with minimum squared Euclidean distance.",
            "Ties are broken by the lowest codebook index.",
            "The commitment loss equals (1 plus beta) times the squared distance to the chosen code.",
        ],
        correctness:
            "Scanning every code and keeping the strict minimum returns the argmin of the squared distances, so the chosen code is globally optimal among the K candidates; using a strict less-than comparison keeps the first entry on a tie. Both terms of the VQ-VAE commitment objective reduce to the squared distance between the encoder output and the selected code, one weighted by beta, so their sum is (1 plus beta) times that distance. The straight-through copy leaves the code fixed in the forward pass while routing gradient to the encoder.",
        complexityRationale:
            "Computing each distance takes d multiplications and additions, so scanning K codes costs O(K times d); finding the minimum is O(K). The only extra storage is the list of K distances, giving O(K) space on top of the codebook itself.",
        uses: [
            "Discrete latent representations for images, audio, and video",
            "Compression and tokenization for autoregressive generative models",
            "Learning reusable visual vocabularies without a continuous posterior",
        ],
        references: [
            "van den Oord, Vinyals and Kavukcuoglu, Neural Discrete Representation Learning, NeurIPS 2017",
            "Razavi, van den Oord and Vinyals, Generating Diverse High-Fidelity Images with VQ-VAE-2, NeurIPS 2019",
        ],
        workedExample:
            "For encoder output (1.1, -0.2) and codes (0,0), (1,0), (0,1), (1,1), the squared distances are about 1.25, 0.05, 2.10 and 0.90. Code 1 wins, so the quantized vector is (1, 0). With beta 0.25 the commitment loss is 1.25 times 0.05, about 0.0625.",
    },
    id: "vq-vae",
    name: "VQ-VAE Codebook Quantization",
    category: "ml-ai",
    complexity: { time: "O(K * d)", space: "O(K)" },
    defaultInput: {
        zE: [1.1, -0.2],
        codebook: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        beta: 0.25,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the encoder output and the codebook vectors",
        "for each code compute squared Euclidean distance",
        "keep the code with the smallest distance",
        "set the quantized vector to that code",
        "form the encoder commitment term",
        "add beta times the reverse commitment term",
        "done: report the chosen code and total commitment loss",
    ],
};

export default module;
