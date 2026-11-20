/**
 * sense-reversing-barrier.ts - Sense-Reversing Collective Barrier
 *
 * A shared counter tracks how many processes have arrived at a barrier and a
 * shared sense bit tells arrivals when everyone is present. The last process
 * to arrive resets the counter and flips the sense; other processes spin until
 * the sense changes. Flipping the sense avoids the need to reinitialize a
 * flag before every epoch.
 *
 * The simulation is deterministic: processes arrive in a supplied order each
 * epoch, and one release is emitted per epoch with the sense toggled. It does
 * not model real spinning, cache coherence traffic, or staggered epochs.
 *
 * Time:  O(processes * epochs) arrivals
 * Space: O(processes) for the arrival state
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    processes?: number;
    epochs?: number;
}

function makeBars(arrived: boolean[], sense: boolean, count: number): VisualEntity[] {
    return arrived.map((yes, i) => ({
        id: `proc-${i}`,
        type: "bar" as const,
        label: `P${i}${yes ? " arrived" : " waiting"}`,
        value: yes ? 1 : 0,
        state: yes ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, arrived: yes, sense, count },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const processes = Math.min(16, Math.max(2, Math.floor(Number(task.processes ?? 6)) || 6));
    const epochs = Math.min(20, Math.max(1, Math.floor(Number(task.epochs ?? 3)) || 3));
    let sense = false;
    let releases = 0;
    let step = 0;

    const metaFor = (epoch: number, count: number, phase: string) => ({
        epoch,
        processes,
        arrivedCount: count,
        sense,
        releases,
        phase,
    });

    yield {
        stepNumber: step,
        entities: makeBars(new Array<boolean>(processes).fill(false), sense, 0),
        edges: [],
        description: `${processes} processes enter barrier epoch 1 with shared sense ${sense}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(1, 0, "init"),
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const arrived = new Array<boolean>(processes).fill(false);
        let count = 0;
        for (let p = 0; p < processes; p += 1) {
            arrived[p] = true;
            count += 1;
            yield {
                stepNumber: step,
                entities: makeBars(arrived, sense, count),
                edges: [],
                description: `Epoch ${epoch}: process ${p} arrives, counter is now ${count} of ${processes}.`,
                codeLineNumber: count === processes ? 3 : 2,
                layout: "array",
                meta: metaFor(epoch, count, "arrive"),
            };
            step += 1;
        }

        sense = !sense;
        releases += 1;
        count = 0;
        yield {
            stepNumber: step,
            entities: makeBars(arrived, sense, count),
            edges: [],
            description: `Epoch ${epoch}: the last process flips sense to ${sense} and resets the counter, releasing all ${processes} processes.`,
            codeLineNumber: 4,
            layout: "array",
            meta: metaFor(epoch, count, "release"),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(new Array<boolean>(processes).fill(true), sense, 0),
        edges: [],
        description: `All ${epochs} epochs completed with ${releases} barrier releases; final sense is ${sense}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(epochs, 0, "done"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A barrier makes every process wait until all have arrived. A sense-reversing barrier uses one counter and one shared sense bit. Each arrival increments the counter; the last one resets the counter and flips the bit. Everyone else watches the bit flip as the signal to continue, so the bit does not need to be reset between rounds.",
        invariants: [
            "The counter never exceeds the number of participating processes.",
            "Exactly one process observes the counter reach the full count and flips the sense.",
            "The sense bit toggles once per completed epoch.",
        ],
        correctness:
            "Because exactly one process arrives when the counter reaches the total, exactly one flip occurs per epoch. Processes waiting on the old sense observe the change and proceed, so no process leaves before all have arrived. Flipping rather than setting the bit means the next epoch reuses the same shared variable safely, because arrivals wait for the opposite value from the one they observed when entering.",
        complexityRationale:
            "Each epoch has one arrival event per process and one release event, so the deterministic simulation uses O(processes times epochs) steps. Only the arrival flags and a few counters are stored, giving O(processes) space.",
        uses: [
            "Synchronizing threads at the end of each phase of a parallel loop",
            "Collective operations in message-passing runtimes",
            "A teaching model for shared-counter synchronization",
        ],
        references: [
            "Hensgen, Finkel, and Manber, Two Algorithms for Barrier Synchronization, 1988",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "With four processes and sense false, arrivals raise the counter to 1, 2, 3, 4. The fourth arrival flips sense to true and resets the counter to zero. Every process then proceeds, and the next epoch waits for sense to become false again.",
    },
    id: "sense-reversing-barrier",
    name: "Sense-Reversing Barrier",
    category: "parallel-distributed",
    complexity: { time: "O(processes * epochs)", space: "O(processes)" },
    defaultInput: { processes: 6, epochs: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a shared counter to zero and a shared sense bit to false",
        "each process remembers the sense it observed on arrival",
        "on arrival atomically increment the shared counter",
        "if the counter reaches the process count reset it and flip sense",
        "otherwise wait until the shared sense changes",
        "when sense changes the process leaves the barrier",
        "repeat for the required number of epochs",
        "done: report the number of barrier releases",
    ],
};

export default module;
