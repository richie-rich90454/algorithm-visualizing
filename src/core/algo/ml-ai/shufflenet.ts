/**
 * shufflenet.ts - Channel Shuffle
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grouped convolutions save computation but only mix channels inside their
 * own group. ShuffleNet reorders the channels between groups so the next
 * grouped convolution can combine information across all groups. The shuffle
 * is a reshape into groups, a transpose, and a flatten back into channels.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C) for C channels
 *   Space: O(C) for the permutation and its inverse
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Each cell is one channel; its label shows where that channel moves.
 *   - Cells are arranged as groups by position within a group.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ShuffleInput {
    channels?: number;
    groups?: number;
}

function permutation(channels: number, groups: number): number[] {
    const perGroup = channels / groups;
    return Array.from({ length: channels }, (_, c) => (c % perGroup) * groups + Math.floor(c / perGroup));
}

function inversePermutation(channels: number, groups: number): number[] {
    const perGroup = channels / groups;
    return Array.from({ length: channels }, (_, c) => (c % groups) * perGroup + Math.floor(c / groups));
}

function cells(channels: number, groups: number, values: number[]): VisualEntity[] {
    const perGroup = channels / groups;
    return Array.from({ length: channels }, (_, c) => {
        const newIndex = values[c] ?? c;
        return {
            id: `chan-${c}`,
            type: "cell" as const,
            label: String(newIndex),
            value: newIndex,
            state: (newIndex === c ? "idle" : "active") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(c / perGroup), col: c % perGroup, channel: c, newIndex },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ShuffleInput | null) ?? {};
    const channels = typeof task.channels === "number" && task.channels > 0 ? Math.max(2, Math.floor(task.channels)) : 8;
    let groups = typeof task.groups === "number" && task.groups > 0 ? Math.floor(task.groups) : 2;
    groups = Math.max(1, Math.min(channels, groups));
    if (channels % groups !== 0) groups = 1;
    const perGroup = channels / groups;

    const forward = permutation(channels, groups);
    const inverse = inversePermutation(channels, groups);
    const identity = Array.from({ length: channels }, (_, c) => inverse[forward[c] ?? 0] ?? c);

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(channels, groups, Array.from({ length: channels }, (_, c) => c)),
        edges: [],
        description: `Arrange ${channels} channels into ${groups} groups of ${perGroup}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phase: "groups", channels, groups, perGroup, rows: groups, cols: perGroup, permutation: [], inverse: [], identity: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(channels, groups, forward),
        edges: [],
        description: "Reshape to groups, transpose, and flatten to reorder the channels.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { phase: "shuffle", channels, groups, perGroup, rows: groups, cols: perGroup, permutation: forward, inverse: [], identity: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(channels, groups, forward),
        edges: [],
        description: "Derive the inverse map that restores each channel to its original place.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { phase: "inverse", channels, groups, perGroup, rows: groups, cols: perGroup, permutation: forward, inverse, identity: [] },
    };
    step += 1;

    const bijective = identity.every((value, c) => value === c);
    yield {
        stepNumber: step,
        entities: cells(channels, groups, forward),
        edges: [],
        description: `Done: shuffle is a bijection: ${bijective ? "yes" : "no"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { phase: "done", channels, groups, perGroup, rows: groups, cols: perGroup, permutation: forward, inverse, identity, bijective },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A grouped convolution keeps each group of channels separate, which is cheap but blocks information flow between groups. Channel shuffle rearranges the channels so that each new group contains channels drawn from several old groups. Stacking grouped convolution and shuffle gives most of the benefit of a full convolution at a fraction of the cost.",
        invariants: [
            "The number of channels is divisible by the number of groups.",
            "The shuffle writes every source channel to exactly one destination.",
            "Applying the inverse permutation restores the original channel order.",
        ],
        correctness:
            "Writing channel c as a pair of group index and position inside the group, the shuffle swaps the roles of those two indices: new index equals position times groups plus group index. This is exactly a reshape to groups by position, a transpose, and a flatten. Because the mapping swaps a pair of coordinates, it is its own inverse structure and composing the derived inverse with the forward map returns every channel to itself, which a brute-force check over all channels confirms.",
        complexityRationale:
            "Computing the destination of each of the C channels is constant work, so time is O(C). The forward permutation, inverse and identity arrays each hold C integers, giving O(C) space.",
        uses: [
            "Lightweight mobile vision backbones",
            "Mixing information between convolution groups",
            "Reducing parameters while keeping cross-channel interaction",
        ],
        references: [
            "Zhang et al., ShuffleNet: An Extremely Efficient Convolutional Neural Network for Mobile Devices, CVPR 2018",
            "Krizhevsky et al., ImageNet Classification with Deep Convolutional Neural Networks, NIPS 2012",
        ],
        workedExample:
            "With eight channels and two groups, the source order is zero through seven split as zero to three and four to seven. After the shuffle the destination of channel c is (c mod four) times two plus the quotient of c divided by four, giving zero, two, four, six, one, three, five, seven. The inverse map sends each destination back to its original channel.",
    },
    id: "shufflenet",
    name: "ShuffleNet Channel Shuffle",
    category: "ml-ai",
    complexity: { time: "O(C)", space: "O(C)" },
    defaultInput: { channels: 8, groups: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the channel count and the number of groups",
        "reshape the channels into groups by position",
        "transpose the group and position indices",
        "flatten to obtain the destination of each channel",
        "derive the inverse that undoes the shuffle",
        "check that the inverse composed with the shuffle is the identity",
        "done: report the permutation and its inverse",
    ],
};

export default module;
