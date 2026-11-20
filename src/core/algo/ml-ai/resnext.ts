/**
 * resnext.ts - ResNeXt Grouped Convolution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ResNeXt replaces a standard convolution with several parallel convolutions,
 * each responsible for a slice of the input and producing a slice of the
 * output. The number of parallel paths is the cardinality. Because each path
 * only sees its own input slice, the total weight count drops by a factor of
 * the cardinality while the output shape stays the same.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^2 * in * out / g) per spatial position for g groups
 *   Space: O(in + out) for the input and output channel slices
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Bars show input channels per group, output channels per group, and the
 *     weight counts for the grouped and dense versions.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GroupedInput {
    inChannels?: number;
    outChannels?: number;
    groups?: number;
    kernel?: number;
}

function bars(labels: string[], values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `metric-${index}`,
        type: "bar" as const,
        label: `${labels[index] ?? ""}:${value}`,
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, metric: labels[index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GroupedInput | null) ?? {};
    const inChannels = typeof task.inChannels === "number" && task.inChannels > 0 ? Math.max(1, Math.floor(task.inChannels)) : 64;
    const outChannels = typeof task.outChannels === "number" && task.outChannels > 0 ? Math.max(1, Math.floor(task.outChannels)) : 64;
    const kernel = typeof task.kernel === "number" && task.kernel > 0 ? Math.max(1, Math.floor(task.kernel)) : 3;
    let groups = typeof task.groups === "number" && task.groups > 0 ? Math.floor(task.groups) : 32;
    groups = Math.max(1, Math.min(groups, Math.min(inChannels, outChannels)));
    if (inChannels % groups !== 0 || outChannels % groups !== 0) groups = 1;
    const inPerGroup = inChannels / groups;
    const outPerGroup = outChannels / groups;
    const perGroupParams = kernel * kernel * inPerGroup * outPerGroup;
    const totalParams = perGroupParams * groups;
    const denseParams = kernel * kernel * inChannels * outChannels;
    const reduction = denseParams / totalParams;

    const shapeLabels = ["in", "in/group", "out", "out/group", "groups"];
    const shapeValues = [inChannels, inPerGroup, outChannels, outPerGroup, groups];
    const paramLabels = ["perGroup", "total", "dense"];
    const paramValues = [perGroupParams, totalParams, denseParams];

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(shapeLabels, shapeValues, shapeValues.map(() => "idle")),
        edges: [],
        description: `Split ${inChannels} inputs and ${outChannels} outputs into ${groups} parallel paths.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", inChannels, outChannels, groups, kernel, inPerGroup, outPerGroup, shapes: shapeValues, params: [], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(shapeLabels, shapeValues, shapeValues.map((_, i) => (i === 0 || i === 2 ? "sorted" : "active"))),
        edges: [],
        description: `Each path reads ${inPerGroup} channels and writes ${outPerGroup} channels.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "split", inChannels, outChannels, groups, kernel, inPerGroup, outPerGroup, shapes: shapeValues, params: [], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(paramLabels, paramValues, paramValues.map((_, i) => (i === 0 ? "active" : "comparing"))),
        edges: [],
        description: `One path carries ${kernel} by ${kernel} times ${inPerGroup} times ${outPerGroup} weights.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "perGroup", inChannels, outChannels, groups, kernel, inPerGroup, outPerGroup, shapes: shapeValues, params: [perGroupParams], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(paramLabels, paramValues, paramValues.map((_, i) => (i === 2 ? "sorted" : "active"))),
        edges: [],
        description: `All groups use ${totalParams} weights versus ${denseParams} for a dense convolution.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "params", inChannels, outChannels, groups, kernel, inPerGroup, outPerGroup, shapes: shapeValues, params: [perGroupParams, totalParams, denseParams], reduction: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(paramLabels, paramValues, paramValues.map((_, i) => (i === 2 ? "sorted" : "active"))),
        edges: [],
        description: `Done: cardinality ${groups} cuts the weight count by a factor of ${reduction.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "done", inChannels, outChannels, groups, kernel, inPerGroup, outPerGroup, shapes: shapeValues, params: [perGroupParams, totalParams, denseParams], reduction },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A regular convolution connects every input channel to every output channel. ResNeXt instead builds many identical narrow paths, each looking at only a slice of the input. Summing their outputs produces the same number of output channels, but each path has far fewer weights. The number of paths, called cardinality, is a second dimension of model capacity alongside depth and width.",
        invariants: [
            "Both input and output channel counts are divisible by the number of groups.",
            "Every group has the same number of input and output channels.",
            "The grouped weight count equals the dense count divided by the cardinality.",
        ],
        correctness:
            "A kernel of size k over ci input and co output channels has k squared times ci times co weights. In a grouped convolution each of the g paths uses ci over g inputs and co over g outputs, so one path has k squared times ci times co divided by g squared weights and all g paths together have k squared times ci times co divided by g. This is exactly the dense count divided by the cardinality, which the brute-force sum over individual groups reproduces.",
        complexityRationale:
            "Evaluating one spatial position costs k squared times inChannels times outChannels divided by groups operations. Only the channel counts and three scalar weight totals are stored, so the extra space is constant.",
        uses: [
            "Efficient high accuracy image classification backbones",
            "Scaling model capacity through cardinality",
            "Replacing wide convolution layers in residual networks",
        ],
        references: [
            "Xie et al., Aggregated Residual Transformations for Deep Neural Networks, CVPR 2017",
            "He et al., Deep Residual Learning for Image Recognition, CVPR 2016",
        ],
        workedExample:
            "With 64 input channels, 64 output channels, a three by three kernel and 32 groups, each path reads two input channels and writes two output channels. One path has 9 times 2 times 2, or 36, weights, so all paths use 1152 weights. A dense layer would use 36864, giving a reduction factor of 32.",
    },
    id: "resnext",
    name: "ResNeXt Grouped Convolution",
    category: "ml-ai",
    complexity: { time: "O(k^2 * in * out / g)", space: "O(in + out)" },
    defaultInput: { inChannels: 64, outChannels: 64, groups: 32, kernel: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the input width, output width, kernel size and cardinality",
        "divide both channel counts by the number of groups",
        "count the weights inside one parallel path",
        "multiply by the number of paths to get the grouped total",
        "count the weights of a dense convolution with the same output",
        "compare the two totals to get the reduction factor",
        "done: report the channel splits and parameter counts",
    ],
};

export default module;
