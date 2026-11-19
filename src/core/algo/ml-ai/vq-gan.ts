/**
 * vq-gan.ts - Vector Quantized GAN Nearest-Code Assignment
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A vector quantized generative model replaces a continuous latent vector with
 * the nearest entry of a learned discrete codebook. The encoder produces a
 * vector z, the codebook is searched for the entry e with the smallest squared
 * Euclidean distance, and e is passed to the generator. A commitment loss keeps
 * z close to its chosen code and the code close to z. This module performs the
 * deterministic nearest-code assignment and reports the resulting loss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * D) to compare an D-dimensional vector with E codebook entries
 *   Space: O(E) for the distance list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the squared distance to each codebook entry while scanning.
 *   - The winning code is finalized in green on the last frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    codebook?: number[][];
    latent?: number[];
    beta?: number;
}

function makeBars(values: number[], current: number, winner: number): VisualEntity[] {
    return values.map((value, i) => {
        let state: EntityState = "idle";
        if (i === winner) {
            state = "sorted";
        } else if (i === current) {
            state = "active";
        } else if (i < current) {
            state = "visited";
        }
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, code: i, distance: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const codebook = (task.codebook ?? [
        [0, 0],
        [2, 2],
        [4, 1],
        [1, 4],
    ]).map((row) => row.slice());
    const latent = (task.latent ?? [1.9, 2.1]).slice();
    const beta = typeof task.beta === "number" ? task.beta : 0.25;

    const distances = codebook.map((code) =>
        code.reduce((sum, value, i) => sum + (value - (latent[i] ?? 0)) ** 2, 0),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(distances, -1, -1),
        edges: [],
        description: `Find the nearest of ${codebook.length} codebook entries for the encoded latent vector.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: codebook.length, codes: codebook.length, beta, winner: -1, loss: 0 },
    };
    step += 1;

    for (let i = 0; i < distances.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(distances, i, -1),
            edges: [],
            description: `Code ${i} has squared distance ${(distances[i] ?? 0).toFixed(4)} from the latent.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { rows: 1, cols: distances.length, code: i, distance: Number((distances[i] ?? 0).toFixed(6)), beta },
        };
        step += 1;
    }

    let winner = 0;
    for (let i = 1; i < distances.length; i += 1) {
        if ((distances[i] ?? Infinity) < (distances[winner] ?? Infinity)) {
            winner = i;
        }
    }
    const quantized = (codebook[winner] ?? []).slice();
    const codebookLoss = distances[winner] ?? 0;
    const commitmentLoss = beta * codebookLoss;
    const loss = codebookLoss + commitmentLoss;

    yield {
        stepNumber: step,
        entities: makeBars(distances, distances.length, winner),
        edges: [],
        description: `Done: code ${winner} is nearest; commitment loss ${loss.toFixed(4)} = codebook loss + beta times the same distance.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            rows: 1,
            cols: distances.length,
            winner,
            distances: distances.map((d) => Number(d.toFixed(6))),
            quantized,
            codebookLoss: Number(codebookLoss.toFixed(6)),
            commitmentLoss: Number(commitmentLoss.toFixed(6)),
            loss: Number(loss.toFixed(6)),
            beta,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of feeding a smooth vector to the generator, vector quantization snaps it to the closest entry in a finite learned dictionary. The search is just nearest neighbor by squared distance. A commitment term stops the encoder from drifting away from the codes it has already learned, so the discrete dictionary and the continuous encoder settle on a shared representation.",
        invariants: [
            "The winning code minimizes the squared Euclidean distance to the latent.",
            "The quantized vector is exactly the winning codebook entry.",
            "The commitment loss is beta times the same squared distance in this static evaluation.",
        ],
        correctness:
            "Nearest-code assignment enumerates every entry and keeps the smallest squared distance, so the selected index is the global minimizer by construction. With stop-gradient operators evaluated at the current values, the codebook term ||sg[z] - e||^2 and the commitment term beta ||z - sg[e]||^2 both equal the squared distance between z and e, giving a total of (1 + beta) times that distance. Gradient descent on this loss moves z and e toward each other.",
        complexityRationale:
            "Comparing a D-dimensional latent with E codes needs E times D subtractions, squares, and additions, so the search is O(E * D) time; only the E distances are stored, giving O(E) extra space.",
        uses: [
            "Discrete latent spaces in image and audio generation",
            "Vector quantized variational autoencoders",
            "Compression-style representations for generative models",
        ],
        references: [
            "Esser, Rombach & Ommer, Taming Transformers for High-Resolution Image Synthesis, CVPR 2021",
            "van den Oord et al., Neural Discrete Representation Learning, NeurIPS 2017",
        ],
        workedExample:
            "For latent [1.9, 2.1] and codes [0,0], [2,2], [4,1], [1,4], the squared distances are about 8.02, 0.02, 4.82, and 4.10. Code 1 wins with distance near 0.02. With beta 0.25 the total loss is 1.25 times 0.02, about 0.025, confirming the latent is already close to its chosen code.",
    },
    id: "vq-gan",
    name: "VQ-GAN Nearest-Code Quantization",
    category: "ml-ai",
    complexity: { time: "O(E * D)", space: "O(E)" },
    defaultInput: {
        codebook: [
            [0, 0],
            [2, 2],
            [4, 1],
            [1, 4],
        ],
        latent: [1.9, 2.1],
        beta: 0.25,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the codebook and the encoded latent vector",
        "for each code compute squared distance to the latent",
        "select the code with the smallest distance",
        "copy that code as the quantized vector",
        "add codebook loss and beta times commitment distance",
        "done: return the winning code and total loss",
    ],
};

export default module;
