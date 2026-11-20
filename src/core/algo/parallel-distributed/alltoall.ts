/**
 * alltoall.ts - All-To-All Personalized Exchange
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In an all-to-all exchange every process has a different message addressed to
 * every other process. After the exchange, process j holds the message that
 * each process i sent specifically to j. This differs from an all-gather,
 * where everyone broadcasts the same data: here each cell of the p by p
 * communication matrix carries a distinct value. The direct version schedules
 * one exchange per unordered pair of processes, so p processes perform p times
 * (p minus 1) over two pair exchanges and every process receives p minus 1
 * messages.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p^2) pairwise exchanges in the direct schedule
 *   Space: O(p^2) for the sent and received matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are sending processes and columns are receiving processes.
 *   - Cell (i, j) holds the message from i to j.
 *   - A pair being exchanged is yellow; delivered messages are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    p?: number;
}

function makeCells(sent: number[][], delivered: boolean[][], pair: [number, number]): VisualEntity[] {
    const p = sent.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < p; j += 1) {
            const done = delivered[i]![j] ?? false;
            const active = i === pair[0] && j === pair[1] || i === pair[1] && j === pair[0];
            const state: EntityState = done ? "sorted" : active ? "comparing" : "idle";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: i === j ? "-" : String(sent[i]![j]),
                value: sent[i]![j] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, sender: i, receiver: j, delivered: done },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const requested = typeof task.p === "number" && Number.isFinite(task.p) ? Math.floor(task.p) : 4;
    const p = Math.max(2, Math.min(8, requested));
    const sent: number[][] = Array.from({ length: p }, (_, i) =>
        Array.from({ length: p }, (_, j) => (i === j ? 0 : i * p + j + 1)));
    const received: number[][] = Array.from({ length: p }, () => Array.from({ length: p }, () => 0));
    const delivered: boolean[][] = Array.from({ length: p }, () => Array.from({ length: p }, () => false));
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < p; i += 1) {
        for (let j = i + 1; j < p; j += 1) pairs.push([i, j]);
    }
    const flat = (m: number[][]) => m.flat();
    const meta = (pairIndex: number, done: boolean) => ({
        p,
        rows: p,
        cols: p,
        sent: flat(sent),
        received: flat(received),
        pairs: pairs.length,
        pairIndex,
        complete: done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(sent, delivered, [-1, -1]),
        edges: [],
        description: `All-to-all personalized exchange on ${p} processes with ${p * (p - 1)} distinct messages.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(-1, false),
    };

    let step = 1;
    for (let index = 0; index < pairs.length; index += 1) {
        const [i, j] = pairs[index] ?? [0, 0];
        received[j]![i] = sent[i]![j] ?? 0;
        received[i]![j] = sent[j]![i] ?? 0;
        delivered[i]![j] = true;
        delivered[j]![i] = true;
        yield {
            stepNumber: step,
            entities: makeCells(sent, delivered, [i, j]),
            edges: [],
            description: `Processes ${i} and ${j} swap their private messages: ${sent[i]![j]} goes to ${j} and ${sent[j]![i]} goes to ${i}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(index, false),
        };
        step += 1;
    }

    let complete = true;
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < p; j += 1) {
            if (i === j) continue;
            if (received[j]![i] !== sent[i]![j]) complete = false;
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells(sent, delivered, [-1, -1]),
        edges: [],
        description: complete
            ? `All ${p * (p - 1)} messages delivered: every process holds one message from each peer.`
            : "Exchange incomplete: a destination did not receive an expected message.",
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(pairs.length, complete),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine every student writes a different note to every other student and all notes are swapped at once. Unlike a broadcast, the note that A sends to B is not the note A sends to C. Scheduling one handshake per unordered pair delivers everything exactly once and makes it easy to check that no message was lost.",
        invariants: [
            "Cell (i, j) always shows the message that i addressed to j, independent of delivery order.",
            "A pair exchange delivers exactly two messages and marks both cells delivered.",
            "After all pairs, received at j from i equals the original message sent by i to j.",
        ],
        correctness:
            "The loop visits every unordered pair (i, j) exactly once. On that visit it copies sent i to j into received j from i and sent j to i into received i to j, which is precisely the definition of a personalized exchange. Because every ordered pair with distinct endpoints belongs to exactly one unordered pair, all p times (p minus 1) messages are copied once and no others are touched, so the final check compares equal values everywhere.",
        complexityRationale:
            "There are p choose two pairwise exchanges, each copying two messages, giving O(p squared) time. The sent matrix, received matrix, and delivery flags each have p squared entries, so space is O(p squared).",
        uses: [
            "Transposing a distributed matrix between process grids",
            "Redistributing data in parallel scientific simulations",
            "All-to-all communication collectives in MPI",
        ],
        references: [
            "Gropp, Lusk, and Skjellum, Using MPI, chapter on collective operations",
            "Thakur and Gropp, Improving the Performance of MPI Collective Operations, 2003",
        ],
        workedExample:
            "With three processes the messages form six distinct values. Pair (0,1) swaps 1 and 4, pair (0,2) swaps 2 and 7, and pair (1,2) swaps 6 and 8. Afterward process 0 holds messages 4 and 7 from its peers, process 1 holds 1 and 8, and process 2 holds 2 and 6.",
    },
    id: "alltoall",
    name: "All-To-All Personalized Exchange",
    category: "parallel-distributed",
    complexity: { time: "O(p^2)", space: "O(p^2)" },
    defaultInput: { p: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "number the processes from zero to p minus one",
        "prepare a distinct message from each process to each other process",
        "for every unordered pair of processes do one exchange",
        "copy the message from i to j into the receive buffer of j",
        "copy the message from j to i into the receive buffer of i",
        "continue until every pair has exchanged",
        "done: report the received matrix and completeness",
    ],
};

export default module;
