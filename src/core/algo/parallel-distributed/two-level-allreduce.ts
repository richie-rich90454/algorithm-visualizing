/**
 * two-level-allreduce.ts - Two-Level Hierarchical All-Reduce
 *
 * A flat all-reduce has every process talk to every other process. On a machine
 * with fast local links and slower links between nodes, a two-level design is
 * cheaper: first reduce sums within each local group, then all-reduce the group
 * totals across group leaders, and finally broadcast the global total back
 * inside each group.
 *
 * This simulation computes the three phases explicitly on a supplied array of
 * per-process values and checks that every process ends with the same sum.
 *
 * Limits: one segment per group, group size divides the process count, and the
 * reduce operation is fixed to addition. Network costs are described, not timed.
 *
 * Time: O(p) work per phase for p processes; Space: O(p).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], highlighted: Set<number>): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `P${index}=${value}`,
        value,
        state: highlighted.has(index) ? ("active" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; groupSize?: number } | null) ?? {};
    const values: number[] = task.values ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const p = values.length;
    const groupSize = Math.max(1, Math.min(p || 1, Math.floor(Number(task.groupSize ?? 4)) || 4));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, new Set()),
        edges: [],
        description: `All-reduce ${p} values across groups of size ${groupSize}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, groupSize, values: values.slice() },
    };
    step += 1;

    if (p === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "With no processes there is no value to reduce.",
            codeLineNumber: 6,
            layout: "array",
            meta: { valid: false },
        };
        return;
    }

    const groups: number[][] = [];
    for (let i = 0; i < p; i += groupSize) {
        groups.push(values.slice(i, i + groupSize).map((_, k) => i + k));
    }

    // Phase 1: local reduce within each group.
    const groupTotals: number[] = [];
    const working = values.slice();
    for (let g = 0; g < groups.length; g += 1) {
        const members = groups[g] as number[];
        const leader = members[0] as number;
        const total = members.reduce((sum, idx) => sum + (values[idx] as number), 0);
        groupTotals.push(total);
        working[leader] = total;
        yield {
            stepNumber: step,
            entities: makeBars(working, new Set(members)),
            edges: [],
            description: `Local reduce in group ${g}: members [${members.join(", ")}] sum to ${total} at leader ${leader}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { group: g, members, total, leader, phase: "local-reduce" },
        };
        step += 1;
    }

    // Phase 2: all-reduce across group leaders.
    const globalTotal = groupTotals.reduce((sum, v) => sum + v, 0);
    const leaders = groups.map((members) => members[0] as number);
    const leadersView = leaders.map((idx) => working[idx] as number);
    yield {
        stepNumber: step,
        entities: makeBars(working, new Set(leaders)),
        edges: [],
        description: `Leaders [${leaders.join(", ")}] hold partial sums [${leadersView.join(", ")}]; global sum is ${globalTotal}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            leaders,
            partialSums: leadersView.slice(),
            globalTotal,
            phase: "leader-allreduce",
        },
    };
    step += 1;

    // Phase 3: broadcast the global total inside each group.
    const result = new Array<number>(p).fill(globalTotal);
    for (let g = 0; g < groups.length; g += 1) {
        const members = groups[g] as number[];
        for (const idx of members) {
            working[idx] = globalTotal;
        }
        yield {
            stepNumber: step,
            entities: makeBars(working, new Set(members)),
            edges: [],
            description: `Broadcast ${globalTotal} inside group ${g} to members [${members.join(", ")}].`,
            codeLineNumber: 5,
            layout: "array",
            meta: { group: g, members, value: globalTotal, phase: "local-broadcast" },
        };
        step += 1;
    }

    const uniform = result.every((v) => v === globalTotal);
    const brute = values.reduce((sum, v) => sum + v, 0);
    yield {
        stepNumber: step,
        entities: makeBars(working, new Set()),
        edges: [],
        description: `Every process now holds ${globalTotal}, matching the direct sum ${brute}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            result: result.slice(),
            globalTotal,
            bruteForceSum: brute,
            correct: uniform && globalTotal === brute,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sending every value to every process wastes slow cross-node links. Two-level all-reduce keeps most traffic local: each group sums its own values first, only the group leaders exchange partial sums over the slow network, and then each leader shares the global answer with its neighbors. The same total reaches everyone with far fewer long-distance messages.",
        invariants: [
            "Each group's local sum includes every member exactly once.",
            "The sum of the group totals equals the sum of all original values.",
            "After the broadcast every process holds the same global total.",
        ],
        correctness:
            "Because addition is associative, summing within groups and then across groups yields the same total as summing all values flat. The leader all-reduce gives every leader that total, and the local broadcast copies it to all members. Therefore every process ends with the global sum, which the simulation confirms by comparing against a direct sum of the input array.",
        complexityRationale:
            "Each process contributes to one local reduce and one local broadcast, and leaders combine a small number of partial sums, so the work is O(p) times a small constant; the buffers use O(p) space.",
        uses: [
            "Gradient aggregation in distributed deep-learning training",
            "Collective operations in MPI and NCCL libraries",
            "Sum reductions on multi-socket and multi-node clusters",
        ],
        references: [
            "Gropp, Lusk and Skjellum, Using MPI, 3rd edition",
            "NVIDIA, NCCL Collective Operations Documentation",
        ],
        workedExample:
            "With values [1,2,3,4,5,6,7,8] and groups of four, the local sums are 10 and 26. Leaders exchange them to get 36, then broadcast 36 inside each group, so all eight processes finish holding 36, the same as the direct sum.",
    },
    id: "two-level-allreduce",
    name: "Two-Level All-Reduce",
    category: "parallel-distributed",
    complexity: { time: "O(p)", space: "O(p)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8], groupSize: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the per-process values and group size",
        "partition the processes into consecutive groups",
        "for each group sum the member values at its leader",
        "combine the group totals into a global sum across leaders",
        "for each group broadcast the global sum to all members",
        "compare the final value with a direct sum",
        "report that every process holds the same total",
    ],
};

export default module;
