/**
 * textual-inversion.ts - Textual Inversion Embedding Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textual inversion personalizes a frozen generative model by learning a new
 * word embedding for a placeholder token. The model weights stay fixed; only
 * the embedding vector moves. Gradient descent nudges it so the model's output
 * embedding matches a target concept, giving a compact textual description of
 * that concept that can be reused in prompts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d^2) for embedding dimension d and a linear proxy model
 *   Space: O(d) for the embedding and its gradient
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the learned embedding vector after each optimization step.
 *   - Meta reports the reconstruction loss driving the updates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TextualInversionInput {
    embedding?: number[];
    target?: number[];
    model?: number[][];
    steps?: number;
    learningRate?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "e"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, weight, i) => sum + weight * (vector[i] ?? 0), 0));
}

function matTransposeVec(matrix: number[][], vector: number[]): number[] {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const result = new Array<number>(cols).fill(0);
    for (let j = 0; j < cols; j += 1) {
        let sum = 0;
        for (let i = 0; i < rows; i += 1) {
            sum += (matrix[i]?.[j] ?? 0) * (vector[i] ?? 0);
        }
        result[j] = sum;
    }
    return result;
}

function lossFor(embedding: number[], model: number[][], target: number[]): number {
    const projected = matVec(model, embedding);
    return 0.5 * projected.reduce((sum, v, i) => sum + (v - (target[i] ?? 0)) ** 2, 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TextualInversionInput | null) ?? {};
    const embedding = [...(task.embedding ?? [0.2, -0.3])];
    const target = task.target ?? [1, 0.5];
    const model = task.model ?? [
        [1, 0.5],
        [0.2, 0.9],
    ];
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 4;
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;

    const losses: number[] = [lossFor(embedding, model, target)];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(embedding, "idle"),
        edges: [],
        description: `Textual inversion optimizing a ${embedding.length}-dimensional placeholder embedding over ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, steps, learningRate: lr, loss: losses[0] ?? 0 },
    };
    step += 1;

    for (let t = 0; t < steps; t += 1) {
        const projected = matVec(model, embedding);
        const residual = projected.map((v, i) => v - (target[i] ?? 0));
        const gradient = matTransposeVec(model, residual);
        for (let i = 0; i < embedding.length; i += 1) {
            embedding[i] = (embedding[i] ?? 0) - lr * (gradient[i] ?? 0);
        }
        const loss = lossFor(embedding, model, target);
        losses.push(loss);
        yield {
            stepNumber: step,
            entities: makeBars(embedding, "active"),
            edges: [],
            description: `Step ${t + 1}: model residual drove a gradient step; reconstruction loss is now ${loss.toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step, iteration: t + 1, loss, embedding: embedding.slice(), losses: losses.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(embedding, "sorted"),
        edges: [],
        description: `Done: loss fell from ${(losses[0] ?? 0).toFixed(6)} to ${(losses[losses.length - 1] ?? 0).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step, embedding: embedding.slice(), losses, loss: losses[losses.length - 1] ?? 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Textual inversion learns a new word just from a few example images. Instead of changing the generator, it holds the model fixed and searches for the embedding vector that makes the model's output look like the target concept. Because only a small vector is optimized, it captures a personalized subject in a compact form that can be dropped into any prompt.",
        invariants: [
            "The generative model weights never change during the search.",
            "Only the placeholder embedding receives gradient updates.",
            "The objective is half the squared error between the projected embedding and the target.",
        ],
        correctness:
            "For a linear proxy model with output A times e, the gradient of half the squared residual with respect to e is A transpose times the residual. The code forms that gradient and applies gradient descent, so the loss must not increase for a small enough step size. The test compares each step against an independent matrix computation and checks that the loss decreases monotonically and approaches the least-squares optimum.",
        complexityRationale:
            "A forward and transpose product with a d by d model costs O(d squared) per step, and only the d-dimensional embedding and gradient are stored, giving O(d) space.",
        uses: [
            "Personalizing text-to-image models with a new concept",
            "Learning compact embeddings for rare subjects or styles",
            "Conditioning generative models with a single learned token",
        ],
        references: [
            "Gal et al., An Image is Worth One Word: Personalizing Text-to-Image Generation, 2023",
            "Rombach et al., High-Resolution Image Synthesis with Latent Diffusion Models, 2022",
        ],
        workedExample:
            "Starting from embedding (0.2, -0.3) with target (1, 0.5), the first projection misses the target, so the residual is fed back through the model transpose and the embedding moves toward values that produce a closer projection. Each step lowers the squared error.",
    },
    id: "textual-inversion",
    name: "Textual Inversion",
    category: "ml-ai",
    complexity: { time: "O(steps * d^2)", space: "O(d)" },
    defaultInput: {
        embedding: [0.2, -0.3],
        target: [1, 0.5],
        model: [
            [1, 0.5],
            [0.2, 0.9],
        ],
        steps: 4,
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "freeze the generative model and initialize a placeholder embedding",
        "for each optimization step project the embedding through the model",
        "compute the residual between the projection and the target",
        "backpropagate the residual through the model transpose",
        "subtract the learning rate times the gradient from the embedding",
        "record the reconstruction loss after the update",
        "repeat for a fixed number of steps",
        "done: report the learned embedding and final loss",
    ],
};

export default module;
