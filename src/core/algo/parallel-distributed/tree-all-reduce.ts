/**
 * tree-all-reduce.ts - Tree All-Reduce Collective
 *
 * Tree all-reduce combines values from every process and then distributes the
 * combined result back to all of them. In the reduce phase, processes paired
 * across a growing stride send their partial sums upward; after log n rounds
 * the root holds the total. The broadcast phase walks the same pairs in reverse
 * so every process learns the total. Each process sends and receives only once
 * per phase, giving logarithmic communication rounds.
 *
 * This is a deterministic simulation with a power-of-two process count,
 * synchronous rounds, additive reduction, and reliable in-order links. It does
 * not model network topology, bandwidth contention, noncommutative operators,
 * or fault tolerance.
 *
 * Time:  O(log n) communication rounds
 * Space: O(n) for the per-process partial results
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface TreeAllReduceInput {
    values?: number[];
}

function makeEntities(values: number[], active: number, final: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `process-${index}`,
        type: "bar" as const,
        label: `p${index}: ${Number(value.toFixed(4))}`,
        value,
        state: final ? "sorted" : index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, partial: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TreeAllReduceInput | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length >= 2
        ? task.values.slice(0, 16).map((v) => Number(v) || 0)
        : [1, 2, 3, 4, 5, 6, 7, 8];
    const n = 2 ** Math.floor(Math.log2(raw.length));
    const values = Array.from({ length: n }, (_, i) => raw[i] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const strides: number[] = [];
    for (let stride = 1; stride < n; stride *= 2) {
        strides.push(stride);
    }

    yield {
        stepNumber: 0,
        entities: makeEntities(values, -1, false),
        edges: [],
        description: `${n} processes hold local values; tree all-reduce will exchange partial sums in ${strides.length} reduce rounds.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { processes: n, values: [...values], stride: 0, phase: "start", total, done: false },
    };

    const partials = [...values];
    let step = 1;
    for (let i = 0; i < strides.length; i += 1) {
        const stride = strides[i] ?? 1;
        for (let sender = stride; sender < n; sender += 2 * stride) {
            const receiver = sender - stride;
            partials[receiver] = (partials[receiver] ?? 0) + (partials[sender] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeEntities(partials, strides.length - 1 - i, false),
            edges: [],
            description: `Reduce stride ${stride}: upper-rank processes send their partial sums to their lower-rank partners.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { processes: n, values: [...partials], stride, phase: "reduce", total, done: false },
        };
        step += 1;
    }

    for (let i = strides.length - 1; i >= 0; i -= 1) {
        const stride = strides[i] ?? 1;
        for (let sender = stride; sender < n; sender += 2 * stride) {
            const receiver = sender - stride;
            partials[sender] = partials[receiver] ?? 0;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(partials, i, false),
            edges: [],
            description: `Broadcast stride ${stride}: the total flows back down the same tree pairs.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { processes: n, values: [...partials], stride, phase: "broadcast", total, done: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(partials, -1, true),
        edges: [],
        description: `Every process now holds the total ${total}; ${2 * strides.length} rounds were used.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            processes: n,
            values: [...partials],
            stride: 0,
            phase: "done",
            total,
            rounds: 2 * strides.length,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A naive all-reduce has every process send its value to every other process, which is expensive. A tree avoids that. Pair processes up and add partial sums upward; after one round half the processes know the sum of two values, after the next quarter know four, and so on. Once the root has the full total, walk the tree backward to hand that same total to everyone. Each process talks to only one partner per round.",
        invariants: [
            "During reduce, a receiver's partial sum is the total of its whole subtree.",
            "A process that has sent its partial sum during reduce stops contributing until broadcast.",
            "After broadcast, every process holds exactly the sum of all initial values.",
        ],
        correctness:
            "Induct on the round. At stride one, each receiver holds the sum of its pair, the correct subtree total for a tree of size two. Assuming receivers hold correct totals for subtrees of size stride, doubling the stride merges two adjacent subtrees by adding their totals, so the invariant holds for the larger tree. After log n rounds the root holds the sum of all n values. The broadcast reverses each merge, copying a known total into the partner that contributed to it, so by induction every process learns the same total.",
        complexityRationale:
            "There are log n reduce rounds and log n broadcast rounds, and all pairs in a round work in parallel, so the critical path is O(log n) rounds. Each of the n processes stores one partial value, giving O(n) space.",
        uses: [
            "Gradient averaging in data-parallel machine learning",
            "Global reductions in MPI and collective communication libraries",
            "Aggregating counters and metrics across a cluster",
        ],
        references: [
            "MPI Forum, MPI: A Message-Passing Interface Standard, Allreduce",
            "Geijn and Watts, Collective Communication: Theory, Practice, and Experience, 2007",
        ],
        workedExample:
            "Eight processes hold one through eight. Stride one pairs (0,1), (2,3), (4,5), (6,7) to get 3, 7, 11, 15 at the lower ranks. Stride two gives 10 and 26, stride four gives 36 at process zero. Broadcasting copies 36 back to every process in three more rounds.",
    },
    id: "tree-all-reduce",
    name: "Tree All-Reduce",
    category: "parallel-distributed",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "place each process's value in its partial slot",
        "for strides one, two, four and so on up to n over two",
        "each upper-rank partner sends its partial to the lower-rank partner",
        "the receiver adds the value into its own partial sum",
        "after the last reduce round the root holds the total",
        "walk the strides in reverse order",
        "copy the root total down to each partner",
        "done: every process holds the same total",
    ],
};

export default module;
