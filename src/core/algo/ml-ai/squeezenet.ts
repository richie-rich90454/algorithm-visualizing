/**
 * squeezenet.ts - SqueezeNet Fire Module
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Fire module first squeezes the input with a one by one convolution into a
 * small number of channels, then expands those channels with a mix of one by
 * one and three by three convolutions. Concatenating the two expansion branches
 * gives the output. This bottleneck drastically cuts the parameter count while
 * keeping enough three by three filters to capture spatial patterns.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(in * s + s * e1 + 9 * s * e3) for one spatial position
 *   Space: O(s + e1 + e3) for the intermediate channel tensors
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Bars show the channel width at each stage of the Fire module.
 *   - A second view shows the parameter count contributed by each branch.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FireInput {
    inChannels?: number;
    squeeze?: number;
    expand1?: number;
    expand3?: number;
}

function bars(labels: string[], values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `stage-${index}`,
        type: "bar" as const,
        label: `${labels[index] ?? ""}:${value}`,
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, stage: labels[index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FireInput | null) ?? {};
    const inChannels = typeof task.inChannels === "number" && task.inChannels > 0 ? Math.max(1, Math.floor(task.inChannels)) : 64;
    const squeeze = typeof task.squeeze === "number" && task.squeeze > 0 ? Math.max(1, Math.floor(task.squeeze)) : 16;
    const expand1 = typeof task.expand1 === "number" && task.expand1 > 0 ? Math.max(1, Math.floor(task.expand1)) : 32;
    const expand3 = typeof task.expand3 === "number" && task.expand3 > 0 ? Math.max(1, Math.floor(task.expand3)) : 32;

    const outChannels = expand1 + expand3;
    const squeezeParams = squeeze * inChannels;
    const expand1Params = expand1 * squeeze;
    const expand3Params = expand3 * squeeze * 9;
    const totalParams = squeezeParams + expand1Params + expand3Params;
    const denseParams = inChannels * outChannels * 9;
    const reduction = denseParams / totalParams;

    const stageLabels = ["in", "squeeze", "expand1", "expand3", "out"];
    const stageValues = [inChannels, squeeze, expand1, expand3, outChannels];
    const paramLabels = ["squeeze", "expand1", "expand3", "total", "dense"];
    const paramValues = [squeezeParams, expand1Params, expand3Params, totalParams, denseParams];

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(stageLabels, stageValues, stageValues.map(() => "idle")),
        edges: [],
        description: `A Fire module maps ${inChannels} input channels through a ${squeeze}-channel bottleneck.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", inChannels, squeeze, expand1, expand3, outChannels, stages: stageValues, params: [], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(stageLabels, stageValues, stageValues.map((_, i) => (i === 1 ? "active" : "comparing"))),
        edges: [],
        description: "The one by one squeeze convolution compresses the channel count.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "squeeze", inChannels, squeeze, expand1, expand3, outChannels, stages: stageValues, params: [squeezeParams], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(stageLabels, stageValues, stageValues.map((_, i) => (i >= 2 && i <= 4 ? "active" : "sorted"))),
        edges: [],
        description: `Expand with ${expand1} one by one and ${expand3} three by three filters and concatenate.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "expand", inChannels, squeeze, expand1, expand3, outChannels, stages: stageValues, params: [squeezeParams, expand1Params, expand3Params], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(paramLabels, paramValues, paramValues.map((_, i) => (i === 3 ? "active" : "sorted"))),
        edges: [],
        description: `The module uses ${totalParams} parameters versus ${denseParams} for a dense layer.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "params", inChannels, squeeze, expand1, expand3, outChannels, stages: stageValues, params: [squeezeParams, expand1Params, expand3Params, totalParams, denseParams], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(paramLabels, paramValues, paramValues.map((_, i) => (i === 4 ? "sorted" : "active"))),
        edges: [],
        description: `Done: the bottleneck reduces parameters by a factor of ${reduction.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "done", inChannels, squeeze, expand1, expand3, outChannels, stages: stageValues, params: [squeezeParams, expand1Params, expand3Params, totalParams, denseParams], reduction },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SqueezeNet keeps accuracy with far fewer parameters by using a narrow bottleneck. A Fire module squeezes the incoming channels with cheap one by one filters, then expands with a mixture of one by one and three by three filters. Most of the cost sits in the small squeezed tensor rather than in a wide input tensor, which is where the savings come from.",
        invariants: [
            "The squeeze convolution has one by one kernels, so it costs squeeze times inChannels weights.",
            "Each three by three expansion filter has nine times as many weights as a one by one filter.",
            "The output channel count is the sum of the two expansion widths.",
        ],
        correctness:
            "A convolution with kernel k, ci input channels and co output channels has k squared times ci times co weights, ignoring bias. Applying that count to the squeeze layer gives squeeze times inChannels, to the one by one branch gives expand1 times squeeze, and to the three by three branch gives nine times expand3 times squeeze. Summing the three branches is the Fire module total, and concatenating the branches yields expand1 plus expand3 output channels. Comparing with a dense three by three layer of the same output width gives the reported reduction factor.",
        complexityRationale:
            "At one spatial position the squeeze convolution costs O(inChannels times squeeze) and the two expansions cost O(squeeze times expand1) and O(9 times squeeze times expand3). Only the channel counts and a handful of scalar totals are stored, so space is O(squeeze plus expand1 plus expand3).",
        uses: [
            "Parameter efficient image classifiers for edge devices",
            "Replacing wide convolution layers with bottleneck blocks",
            "Teaching the effect of one by one convolutions",
        ],
        references: [
            "Iandola et al., SqueezeNet: AlexNet-Level Accuracy with 50x Fewer Parameters, ICLR 2017",
            "Lin et al., Network in Network, ICML 2014",
        ],
        workedExample:
            "With 64 input channels, squeeze 16, expand1 32 and expand3 32, the squeeze branch has 1024 weights, the one by one expansion has 512, and the three by three expansion has 4608, for a total of 6144. A dense three by three layer with 64 outputs would have 36864 weights, so the Fire module is six times smaller.",
    },
    id: "squeezenet",
    name: "SqueezeNet Fire Module",
    category: "ml-ai",
    complexity: { time: "O(in * s + s * e1 + 9 * s * e3)", space: "O(s + e1 + e3)" },
    defaultInput: { inChannels: 64, squeeze: 16, expand1: 32, expand3: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "read the input width and the three Fire module widths",
        "squeeze the input with one by one filters",
        "expand with one by one filters and keep that branch",
        "expand with three by three filters and keep that branch",
        "concatenate the two expansion branches",
        "count the weights in each branch and sum them",
        "done: report the output width and the parameter reduction",
    ],
};

export default module;
