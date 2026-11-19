/**
 * dreambooth.ts - DreamBooth Prior-Preservation Fine-Tuning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DreamBooth personalizes a generative model using only a few photos of a
 * subject. It binds a rare token to the subject by finetuning the weights, but
 * that alone would make the model forget the rest of the class. A class-specific
 * prior-preservation loss compares the model on ordinary class images against
 * snapshots from the original model, anchoring the concept. This demo uses a
 * linear proxy model so the two-term objective and its gradient are exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d * (ns + np)) for dimension d and n subject/prior samples
 *   Space: O(d) for the model weights and gradient
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the shared weight vector after each fine-tuning step.
 *   - Meta reports the subject term, the prior term, and the combined loss.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DreamBoothInput {
    subjectInputs?: number[][];
    subjectTargets?: number[];
    priorInputs?: number[][];
    priorTargets?: number[];
    weights?: number[];
    lambdaPrior?: number;
    steps?: number;
    learningRate?: number;
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
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

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DreamBoothInput | null) ?? {};
    const subjectInputs: number[][] = task.subjectInputs ?? [
        [1, 0],
        [0, 1],
    ];
    const subjectTargets: number[] = task.subjectTargets ?? [1, 1];
    const priorInputs: number[][] = task.priorInputs ?? [
        [1, 0],
        [0, 1],
    ];
    const priorTargets: number[] = task.priorTargets ?? [0, 0];
    const weights = [...(task.weights ?? [0, 0])];
    const lambdaPrior = typeof task.lambdaPrior === "number" ? task.lambdaPrior : 0.5;
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 20;
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const d = weights.length;

    const subjectLosses: number[] = [];
    const priorLosses: number[] = [];
    const totalLosses: number[] = [];
    const priorPreds: number[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(weights, "idle", "w"),
        edges: [],
        description: `DreamBooth fine-tuning with ${subjectInputs.length} subject and ${priorInputs.length} prior samples, prior weight ${lambdaPrior}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, steps, lambdaPrior, learningRate, weights: [...weights], totalLoss: 0 },
    };
    step += 1;

    for (let t = 0; t < steps; t += 1) {
        const gradient = new Array<number>(d).fill(0);
        let subjectLoss = 0;
        let priorLoss = 0;

        for (let i = 0; i < subjectInputs.length; i += 1) {
            const x = subjectInputs[i] ?? [];
            const residual = dot(weights, x) - (subjectTargets[i] ?? 0);
            subjectLoss += 0.5 * residual * residual;
            for (let j = 0; j < d; j += 1) {
                gradient[j] = (gradient[j] ?? 0) + residual * (x[j] ?? 0);
            }
        }
        for (let i = 0; i < priorInputs.length; i += 1) {
            const x = priorInputs[i] ?? [];
            const residual = dot(weights, x) - (priorTargets[i] ?? 0);
            priorLoss += 0.5 * residual * residual;
            for (let j = 0; j < d; j += 1) {
                gradient[j] = (gradient[j] ?? 0) + lambdaPrior * residual * (x[j] ?? 0);
            }
        }

        for (let j = 0; j < d; j += 1) {
            weights[j] = (weights[j] ?? 0) - learningRate * (gradient[j] ?? 0);
        }
        const totalLoss = subjectLoss + lambdaPrior * priorLoss;
        subjectLosses.push(subjectLoss);
        priorLosses.push(priorLoss);
        totalLosses.push(totalLoss);
        priorPreds.push(dot(weights, priorInputs[0] ?? []));

        yield {
            stepNumber: step,
            entities: bars(weights, t === steps - 1 ? "sorted" : "active", "w"),
            edges: [],
            description: `Step ${t + 1}: subject loss ${subjectLoss.toFixed(5)}, prior loss ${priorLoss.toFixed(5)}, combined ${totalLoss.toFixed(5)}; weights updated.`,
            codeLineNumber: t === steps - 1 ? 6 : 3,
            layout: "array",
            meta: {
                step,
                iteration: t + 1,
                weights: [...weights],
                subjectLoss,
                priorLoss,
                totalLoss,
                subjectLosses: subjectLosses.slice(),
                priorLosses: priorLosses.slice(),
                totalLosses: totalLosses.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(weights, "sorted", "w"),
        edges: [],
        description: `Done: ${steps} steps; weights [${weights.map((w) => w.toFixed(4)).join(", ")}], combined loss ${(totalLosses.at(-1) ?? 0).toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            step,
            weights: [...weights],
            subjectLosses,
            priorLosses,
            totalLosses,
            totalLoss: totalLosses.at(-1) ?? 0,
            priorPreds,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A handful of photos are not enough to teach a large model a new subject from scratch, and finetuning on only those photos makes the model collapse onto them. DreamBooth ties a rare token to the subject and simultaneously asks the model to keep producing ordinary examples of the class, using the original model as a teacher for those examples. The prior term is what preserves the class while the subject is learned.",
        invariants: [
            "Subject and prior samples share one weight vector, so they compete for capacity.",
            "The gradient from prior samples is scaled by the prior-preservation weight.",
            "Setting the prior weight to zero removes any dependence on the prior samples.",
        ],
        correctness:
            "For a linear model the subject term contributes sum of residual times input to the gradient and the prior term contributes lambda times its own residual-times-input sum. The generator forms exactly that gradient and applies gradient descent, so replaying the recurrence reproduces every weight vector and loss. With conflicting subject and prior targets, increasing lambda pulls the solution toward the prior target, which is the preservation effect the test verifies.",
        complexityRationale:
            "Each step evaluates ns plus np dot products and accumulates a d-dimensional gradient, costing O(d (ns + np)); over steps that is O(steps d (ns + np)). Only the d weights and their gradient are stored, O(d) space.",
        uses: [
            "Personalizing text-to-image models from a few user photos",
            "Retaining a pretrained concept while learning a rare new token",
            "Any finetuning setting that needs a regularizer against catastrophic forgetting",
        ],
        references: [
            "Ruiz et al., DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation, CVPR 2023",
            "Kirkpatrick et al., Overcoming Catastrophic Forgetting in Neural Networks, 2017",
        ],
        workedExample:
            "With a subject target of 1 and a prior target of 0 on the same input direction, lambda zero drives the weight to 1 and forgets the class. With lambda 0.5 the fixed point moves to about 0.67, so the prior prediction stays near zero while the subject prediction is still elevated, illustrating the preservation tradeoff.",
    },
    id: "dreambooth",
    name: "DreamBooth Prior Preservation",
    category: "ml-ai",
    complexity: { time: "O(steps * d * (ns + np))", space: "O(d)" },
    defaultInput: {
        subjectInputs: [
            [1, 0],
            [0, 1],
        ],
        subjectTargets: [1, 1],
        priorInputs: [
            [1, 0],
            [0, 1],
        ],
        priorTargets: [0, 0],
        weights: [0, 0],
        lambdaPrior: 0.5,
        steps: 20,
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize shared weights and set the prior-preservation weight",
        "for each training step accumulate the subject gradient and loss",
        "accumulate the prior gradient and loss scaled by the prior weight",
        "subtract the learning rate times the combined gradient from the weights",
        "record the subject, prior, and combined losses for this step",
        "repeat for a fixed number of steps",
        "done: report the finetuned weights and final losses",
    ],
};

export default module;
