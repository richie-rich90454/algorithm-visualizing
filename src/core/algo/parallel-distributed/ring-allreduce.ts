/**
 * ring-allreduce.ts - Ring All-Reduce (Reduce-Scatter then All-Gather)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ring all-reduce sums equally sized vectors held by p workers without a
 * central reducer. The buffer is split into p chunks. In the reduce-scatter
 * phase each worker sends one chunk around the ring and adds what it receives,
 * so after p-1 rounds each worker owns the fully summed chunk p+1 (mod p). In
 * the all-gather phase the summed chunks are passed around the ring again until
 * every worker holds the complete reduced vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((p - 1) * n) per worker for p workers and n total elements
 *   Space: O(n) per worker for its buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid has one row per worker and one column per chunk.
 *   - A cell being sent is highlighted; a cell receiving an addition is active.
 *   - The final frame shows every worker holding the same summed vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RingInput {
    workers?: number;
    data?: number[][];
}

interface PhaseState {
    buffers: number[][];
    sendChunk: number;
    receiveChunk: number;
    sender: number;
    receiver: number;
}

/** Normalize the input into p buffers of p chunks (one chunk per worker). */
function normalize(input: unknown) {
    const task = (input as RingInput | null) ?? {};
    if (Array.isArray(task.data) && task.data.length > 0) {
        const p = Math.min(8, Math.max(2, task.data.length));
        const buffers = Array.from({ length: p }, (_, w) =>
            Array.from({ length: p }, (_, j) => Number(task.data?.[w]?.[j] ?? 0) || 0),
        );
        return { p, c: p, buffers };
    }
    const p = Math.min(8, Math.max(2, Math.floor(Number(task.workers ?? 4)) || 4));
    const buffers = Array.from({ length: p }, (_, w) =>
        Array.from({ length: p }, (_, j) => (w + 1) * 10 + j),
    );
    return { p, c: p, buffers };
}

function makeEntities(buffers: number[][], phase: PhaseState | null): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const p = buffers.length;
    const c = buffers[0]?.length ?? 0;
    for (let w = 0; w < p; w += 1) {
        for (let j = 0; j < c; j += 1) {
            let state: EntityState = "idle";
            if (phase) {
                if (w === phase.receiver && j === phase.receiveChunk) state = "active";
                else if (w === phase.sender && j === phase.sendChunk) state = "comparing";
            }
            const value = buffers[w]?.[j] ?? 0;
            entities.push({
                id: `cell-${w}-${j}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: j,
                y: w,
                width: 0,
                height: 0,
                metadata: { row: w, col: j, worker: w, chunk: j },
            });
        }
    }
    return entities;
}

/** The ring all-reduce generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const { p, c, buffers } = normalize(input);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(buffers, null),
        edges: [],
        description: `${p} workers each hold a ${c}-chunk vector; the first all-reduce round begins.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { workers: p, chunks: c, phase: "init", rows: p, cols: c, buffers: buffers.flat() },
    };
    step += 1;

    // Reduce-scatter: after p-1 rounds worker w owns the fully summed chunk (w+1) mod p.
    for (let k = 0; k < p - 1; k += 1) {
        const sends: Array<{ from: number; to: number; chunk: number; value: number }> = [];
        for (let w = 0; w < p; w += 1) {
            const chunk = (w - k + p) % p;
            sends.push({ from: w, to: (w + 1) % p, chunk, value: buffers[w]![chunk]! });
        }
        const receiveChunkOf = (w: number) => (w - k - 1 + p) % p;
        const displayPhase: PhaseState = {
            buffers,
            sendChunk: (0 - k + p) % p,
            receiveChunk: receiveChunkOf(0),
            sender: 0,
            receiver: (0 + 1) % p,
        };
        for (const send of sends) {
            const targetChunk = receiveChunkOf(send.to);
            buffers[send.to]![targetChunk] = buffers[send.to]![targetChunk]! + send.value;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(buffers, displayPhase),
            edges: [],
            description: `Reduce-scatter round ${k + 1}: every worker sends one chunk clockwise and adds the chunk received from its neighbor.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                workers: p,
                chunks: c,
                phase: "reduce-scatter",
                round: k + 1,
                rows: p,
                cols: c,
                buffers: buffers.flat(),
            },
        };
        step += 1;
    }

    // All-gather: redistribute the summed chunks so every worker has all of them.
    for (let k = 0; k < p - 1; k += 1) {
        const sends: Array<{ from: number; to: number; chunk: number; value: number }> = [];
        for (let w = 0; w < p; w += 1) {
            const chunk = (w + 1 - k + p) % p;
            sends.push({ from: w, to: (w + 1) % p, chunk, value: buffers[w]![chunk]! });
        }
        const receiveChunkOf = (w: number) => (w - k + p) % p;
        const displayPhase: PhaseState = {
            buffers,
            sendChunk: (0 + 1 - k + p) % p,
            receiveChunk: receiveChunkOf(0),
            sender: 0,
            receiver: (0 + 1) % p,
        };
        for (const send of sends) {
            buffers[send.to]![receiveChunkOf(send.to)] = send.value;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(buffers, displayPhase),
            edges: [],
            description: `All-gather round ${k + 1}: workers forward a fully summed chunk so every worker learns it.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                workers: p,
                chunks: c,
                phase: "all-gather",
                round: k + 1,
                rows: p,
                cols: c,
                buffers: buffers.flat(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(buffers, null),
        edges: [],
        description: `All-reduce complete: every worker holds the same ${c}-element sum.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            workers: p,
            chunks: c,
            phase: "done",
            rows: p,
            cols: c,
            buffers: buffers.flat(),
            result: buffers[0] ? [...buffers[0]] : [],
            done: true,
        },
    };
}

/** The ring all-reduce module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single reducer would be a bottleneck, so ring all-reduce makes every worker both a sender and a receiver. Divide the vector into one chunk per worker. First pass messages around the ring so each worker accumulates the full sum of one chunk, then pass those finished chunks around so everyone ends up with the whole answer.",
        invariants: [
            "In reduce-scatter, each chunk is visited by every worker exactly once.",
            "After reduce-scatter, chunk j is completely summed in exactly one worker.",
            "After all-gather, all workers hold identical buffers equal to the element-wise sum.",
        ],
        correctness:
            "Each reduce-scatter round adds one worker's copy of a chunk into the next worker along the ring, and because the ring has p-1 steps every chunk accumulates contributions from all p workers. The worker that completes chunk j then forwards that exact sum during all-gather, which visits every other worker in p-1 steps. Hence each worker's final buffer equals the sum of all starting buffers.",
        complexityRationale:
            "There are 2(p-1) rounds, and each round sends n/p elements around the ring, so each worker transmits about 2n(p-1)/p elements, which is O(n) per worker for fixed chunk size. Buffers require O(n) space per worker; no O(n) central aggregator is needed.",
        uses: [
            "Gradient averaging in distributed deep-learning training",
            "Collective reduction in MPI and NCCL",
            "Parameter synchronization in data-parallel clusters",
        ],
        references: [
            "Patarasuk and Yuan, Bandwidth Optimal All-reduce Algorithms for Clusters of Workstations, 2009",
            "MPI Forum, MPI: A Message-Passing Interface Standard, Chapter 7",
        ],
        workedExample:
            "With three workers holding [10, 11, 12], [20, 21, 22], and [30, 31, 32], two reduce-scatter rounds build the sums 60, 63, and 66 in different workers. Two all-gather rounds copy those sums to everyone, so each worker ends with [60, 63, 66].",
    },
    id: "ring-allreduce",
    name: "Ring All-Reduce",
    category: "parallel-distributed",
    complexity: { time: "O((p - 1) * n)", space: "O(n)" },
    defaultInput: {
        workers: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split each worker's vector into p chunks",
        "for k from 0 to p-2: reduce-scatter round",
        "send chunk (w-k) mod p from worker w to worker w+1",
        "add the chunk received from worker w-1 into the local copy",
        "for k from 0 to p-2: all-gather round",
        "forward a fully summed chunk to the next worker in the ring",
        "done: every worker holds the element-wise sum",
    ],
};

export default module;
