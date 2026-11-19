/**
 * vision-transformer.ts - Vision Transformer Patch Embedding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A vision transformer treats an image like a sequence of words. It cuts the
 * image into fixed-size patches, flattens each patch, and projects it into a
 * token embedding with a learned linear map. A trainable class token is prepended
 * and positional embeddings are added so the model knows where each patch came
 * from. This demo performs that patch-to-token construction on a tiny 4x4 image.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * p^2 * d) for P patches of p by p pixels and embedding size d
 *   Space: O(P * d) for the resulting token sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first frames show the image pixels and the extracted patches.
 *   - Later frames show patch embeddings, then the class token and positions.
 *   - The final frame shows the complete token sequence as bars.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VitInput {
    image: number[];
    gridSize: number;
    patchSize: number;
    projection: number[][];
    bias: number[];
    classToken: number[];
    positions: number[][];
}

/** Build bar entities for a flattened vector. */
function makeBars(values: number[], stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `value-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 26,
        y: 0,
        width: 14,
        height: 0,
        metadata: { index, stage, value },
    }));
}

/** Extract non-overlapping patches in row-major order. */
function extractPatches(image: number[], grid: number, patch: number): number[][] {
    const patches: number[][] = [];
    for (let row = 0; row < grid; row += patch) {
        for (let col = 0; col < grid; col += patch) {
            const values: number[] = [];
            for (let dy = 0; dy < patch; dy += 1) {
                for (let dx = 0; dx < patch; dx += 1) {
                    const r = row + dy;
                    const c = col + dx;
                    values.push(image[r * grid + c] ?? 0);
                }
            }
            patches.push(values);
        }
    }
    return patches;
}

/** The vision transformer generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<VitInput> | null) ?? {};
    const image: number[] = task.image ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const gridSize = typeof task.gridSize === "number" ? task.gridSize : 4;
    const patchSize = typeof task.patchSize === "number" ? task.patchSize : 2;
    const projection: number[][] = task.projection ?? [
        [0.1, 0.0, 0.2],
        [0.0, 0.3, 0.1],
        [0.2, 0.0, 0.1],
        [0.0, 0.1, 0.4],
    ];
    const bias: number[] = task.bias ?? [0, 0, 0];
    const classToken: number[] = task.classToken ?? [1, 0, 0];
    const positions: number[][] = task.positions ?? [
        [0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.01], [0.01, 0.01, 0], [0, 0.01, 0.01],
    ];

    const patches = extractPatches(image, gridSize, patchSize);
    yield {
        stepNumber: 0,
        entities: makeBars(image, "image", false),
        edges: [],
        description: `Input image with ${image.length} pixels in a ${gridSize} by ${gridSize} grid.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "image", patches: patches.length, values: image.map((v) => Number(v.toFixed(6))) },
    };

    const patchValues = patches.flat();
    yield {
        stepNumber: 1,
        entities: makeBars(patchValues, "patches", false),
        edges: [],
        description: `Split the image into ${patches.length} patches of ${patchSize} by ${patchSize} pixels.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { stage: "patches", patches: patches.length, values: patchValues.map((v) => Number(v.toFixed(6))) },
    };

    const embeddings = patches.map((patch) =>
        projection[0]?.map((_, d) => {
            let sum = bias[d] ?? 0;
            patch.forEach((value, i) => {
                sum += value * (projection[i]?.[d] ?? 0);
            });
            return sum;
        }) ?? [],
    );
    yield {
        stepNumber: 2,
        entities: makeBars(embeddings.flat(), "embeddings", false),
        edges: [],
        description: `Projected each patch into a ${(embeddings[0] ?? []).length}-dimensional embedding.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { stage: "embeddings", patches: patches.length, values: embeddings.flat().map((v) => Number(v.toFixed(6))) },
    };

    const tokens = [classToken.slice(), ...embeddings];
    const positioned = tokens.map((token, index) =>
        token.map((value, d) => value + (positions[index]?.[d] ?? 0)),
    );
    yield {
        stepNumber: 3,
        entities: makeBars(positioned.flat(), "tokens", true),
        edges: [],
        description: `Class token plus ${embeddings.length} patch tokens with positional embeddings: ${positioned.length} tokens total.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { stage: "tokens", patches: patches.length, tokenCount: positioned.length, values: positioned.flat().map((v) => Number(v.toFixed(6))) },
    };
}

/** The Vision Transformer module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A vision transformer borrows the word-sequence machinery of NLP and applies it to images. It chops the picture into small square patches, flattens each patch into a vector, and linearly projects that vector into a token. A special class token stands for the whole image, and positional embeddings tell the model where each patch belonged. The sequence of tokens then feeds an ordinary transformer encoder.",
        invariants: [
            "Patches are non-overlapping and together cover the entire image.",
            "Every patch projects to the same embedding dimension.",
            "The final token count is one class token plus one token per patch.",
        ],
        correctness:
            "The generator extracts patches in row-major order, multiplies each by the projection matrix, prepends the class token, and adds positional embeddings. The test recomputes the same construction independently and checks the exact final token values, the token count, and the patch count, confirming that the image-to-sequence mapping is correct.",
        complexityRationale:
            "There are P patches, each of p by p pixels projected to d dimensions, costing O(P * p^2 * d) multiply-adds. The token sequence stores P vectors of length d, so space is O(P * d).",
        uses: [
            "Image classification with ViT and DeiT models",
            "Backbones for detection and segmentation such as DETR",
            "Teaching how attention models can consume non-text data",
        ],
        references: [
            "Dosovitskiy et al., An Image is Worth 16x16 Words, ICLR 2021",
            "Touvron et al., Training Data-Efficient Image Transformers, ICML 2021",
        ],
        workedExample:
            "A 4x4 image with 2x2 patches yields four patches: [1,2,5,6], [3,4,7,8], [9,10,13,14], and [11,12,15,16]. Each is projected to three embedding values, a class token is placed first, and five positional vectors are added, producing a five-token sequence shown in the final frame.",
    },
    id: "vision-transformer",
    name: "Vision Transformer Patch Embedding",
    category: "ml-ai",
    complexity: { time: "O(P * p^2 * d)", space: "O(P * d)" },
    defaultInput: { image: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
    visualType: "array",
    run,
    pseudocode: [
        "read the image and the patch size",
        "split the image into non-overlapping patches",
        "flatten each patch into a vector",
        "project each flattened patch into an embedding",
        "prepend the learnable class token",
        "add the positional embedding to every token",
        "emit the final token sequence",
    ],
};

export default module;
