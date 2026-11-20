/**
 * dissemination-barrier.ts - Dissemination Barrier
 *
 * A barrier with no shared counter or sense bit. In round r each process sends
 * an arrival notification to process (i + 2^r) modulo p and waits for a
 * notification from process (i - 2^r) modulo p. After log2(p) rounds every
 * process has heard from enough peers to know that all have arrived.
 *
 * The simulation is deterministic: all processes send and receive in lockstep
 * within a round. It does not model message latency, timeouts, or non-power-of-
 * two process counts, which are handled by other barrier designs.
 *
 * Time:  O(epochs * log2(processes) * processes)
 * Space: O(processes)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    processes?: number;
    epochs?: number;
}

function makeBars(completed: number[], released: boolean, rounds: number): VisualEntity[] {
    return completed.map((value, i) => ({
        id: `proc-${i}`,
        type: "bar" as const,
        label: `P${i}: ${released ? "released" : `round ${value}/${rounds}`}`,
        value: released ? 1 : value,
        state: released ? "sorted" : value > 0 ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, completed: value, released, rounds },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const processes = Math.min(16, Math.max(2, Math.floor(Number(task.processes ?? 4)) || 4));
    const epochs = Math.min(20, Math.max(1, Math.floor(Number(task.epochs ?? 2)) || 2));
    const rounds = Math.ceil(Math.log2(processes));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(processes).fill(0), false, rounds),
        edges: [],
        description: `${processes} processes enter a dissemination barrier with ${rounds} rounds per epoch.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { processes, epochs, rounds, epoch: 0, round: 0, releases: 0 },
    };
    step += 1;

    let releases = 0;
    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const completed = new Array<number>(processes).fill(0);
        for (let round = 0; round < rounds; round += 1) {
            const offset = 2 ** round;
            let sends = 0;
            for (let i = 0; i < processes; i += 1) {
                const target = (i + offset) % processes;
                if (target >= 0 && target < processes) sends += 1;
            }
            for (let i = 0; i < processes; i += 1) {
                completed[i] = round + 1;
            }
            yield {
                stepNumber: step,
                entities: makeBars(completed, false, rounds),
                edges: [],
                description: `Epoch ${epoch}, round ${round + 1}: each process signals rank (i + ${offset}) mod ${processes} and waits for rank (i - ${offset}) mod ${processes}.`,
                codeLineNumber: round === rounds - 1 ? 3 : 2,
                layout: "array",
                meta: { processes, epochs, rounds, epoch, round: round + 1, offset, sends, completed: [...completed], releases },
            };
            step += 1;
        }
        releases += 1;
        yield {
            stepNumber: step,
            entities: makeBars(completed, true, rounds),
            edges: [],
            description: `Epoch ${epoch}: every process has received enough notifications, so all ${processes} processes leave the barrier.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { processes, epochs, rounds, epoch, round: rounds, completed: [...completed], releases },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(processes).fill(rounds), true, rounds),
        edges: [],
        description: `Completed ${epochs} epochs with ${releases} barrier releases after ${rounds} dissemination rounds each.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { processes, epochs, rounds, round: rounds, releases, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of watching a shared counter, each process tells a few specific peers that it has arrived. In the first round it tells its immediate neighbor; in the next it tells the process two away, then four away, and so on. After doubling the distance log2(p) times, information from every process has reached every other process, so each can leave the barrier independently.",
        invariants: [
            "Round r uses partner distance 2 raised to the r.",
            "Every process sends exactly one notification per round.",
            "No process is released before all processes complete the final round.",
        ],
        correctness:
            "After round r a process has directly or indirectly heard from at most 2^(r+1) processes, because each notification doubles the span of known arrivals. After log2(p) rounds the reachable set covers all p processes, so every process can safely conclude that all have arrived. The test checks the round count, the per-round send count, and that a release happens only after the final round in every epoch.",
        complexityRationale:
            "Each epoch performs p sends in each of log2(p) rounds, so the deterministic simulation takes O(epochs times log2(p) times p) events. Only the per-process round counters are kept, giving O(p) space.",
        uses: [
            "Synchronizing large parallel jobs without a contended shared counter",
            "Collective synchronization on distributed-memory machines",
            "A teaching alternative to centralized and sense-reversing barriers",
        ],
        references: [
            "Hensgen, Finkel, and Manber, Two Algorithms for Barrier Synchronization, 1988",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "With four processes, round 1 pairs 0 with 1 and 2 with 3. Round 2 uses distance 2, pairing 0 with 2 and 1 with 3. After those two rounds each process knows all four have arrived, so the barrier releases and the next epoch begins.",
    },
    id: "dissemination-barrier",
    name: "Dissemination Barrier",
    category: "parallel-distributed",
    complexity: { time: "O(epochs * log2(processes) * processes)", space: "O(processes)" },
    defaultInput: { processes: 4, epochs: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the process count and number of epochs",
        "compute the number of rounds as log base two of the process count",
        "for each epoch reset all arrival counters to zero",
        "in each round send to rank i plus two to the round power",
        "wait for the message from rank i minus two to the round power",
        "after the final round release all processes together",
        "repeat for all epochs and report the release count",
    ],
};

export default module;
