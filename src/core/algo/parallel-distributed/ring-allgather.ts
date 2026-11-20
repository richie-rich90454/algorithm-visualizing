/**
 * ring-allgather.ts - Ring All-Gather Collective
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a ring all-gather, p processes each begin with one distinct chunk. At
 * step k each process sends the chunk it received at step k-1 (its own chunk
 * when k is zero) to its neighbor on the right. After p-1 steps every process
 * holds every chunk, and the chunks are reconstructed in their original order.
 * The algorithm moves each chunk p-1 times and needs no central coordinator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) communication steps with O(m) data per message
 *   Space: O(p * m) to hold the gathered result at each process
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are processes; columns are chunk indices.
 *   - A held chunk is green; a chunk acquired in the current step is yellow.
 *   - An empty cell is idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type AllGatherInput = { chunks?: number[][] };

function makeCells(
    chunks: number[][],
    held: boolean[][],
    fresh: Set<string>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let process = 0; process < chunks.length; process += 1) {
        for (let chunk = 0; chunk < chunks.length; chunk += 1) {
            const id = `cell-${process}-${chunk}`;
            const owns = held[process]?.[chunk] ?? false;
            entities.push({
                id,
                type: "cell" as const,
                label: owns ? `[${(chunks[chunk] ?? []).join(",")}]` : "-",
                value: owns ? [...(chunks[chunk] ?? [])] : [],
                state: fresh.has(id) ? "comparing" : owns ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: process, col: chunk, process, chunk },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AllGatherInput | null) ?? {};
    const chunks: number[][] = Array.isArray(task.chunks)
        ? task.chunks.map((chunk) => [...chunk])
        : [
              [1, 2],
              [3, 4],
              [5, 6],
              [7, 8],
          ];
    const processes = Math.max(1, Math.min(8, chunks.length));

    const held: boolean[][] = Array.from({ length: processes }, (_, p) =>
        Array.from({ length: processes }, (_, c) => p === c),
    );
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(chunks, held, new Set()),
        edges: [],
        description: `${processes} processes begin the ring all-gather, each holding one chunk.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step: 0, processes, transfers: 0, complete: processes === 1 },
    };
    step += 1;

    let transfers = 0;
    for (let k = 0; k < processes - 1; k += 1) {
        const fresh = new Set<string>();
        const sent: string[] = [];
        for (let i = 0; i < processes; i += 1) {
            const chunk = (i - k + processes) % processes;
            const receiver = (i + 1) % processes;
            if (!(held[receiver]?.[chunk] ?? false)) {
                fresh.add(`cell-${receiver}-${chunk}`);
            }
            (held[receiver] as boolean[])[chunk] = true;
            sent.push(`P${i} sends chunk ${chunk} to P${receiver}`);
            transfers += 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(chunks, held, fresh),
            edges: [],
            description: `Step ${k + 1}: ${sent.join("; ")}.`,
            codeLineNumber: k === 0 ? 2 : 3,
            layout: "grid",
            meta: { step: k + 1, processes, transfers, sent, complete: k === processes - 2 },
        };
        step += 1;
    }

    const complete = held.every((row) => row.every(Boolean));
    yield {
        stepNumber: step,
        entities: makeCells(chunks, held, new Set()),
        edges: [],
        description: complete
            ? `All-gather complete after ${processes - 1} steps; every process holds all ${processes} chunks.`
            : "All-gather ended with missing chunks.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { step: processes - 1, processes, transfers, complete, gathered: chunks.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Arrange the processes in a circle and pass data in one direction. Each process contributes the chunk it just received, so after a fixed number of rounds everyone has seen every chunk. The same pattern underlies ring all-reduce, where a reduction replaces concatenation.",
        invariants: [
            "After step k, each process holds k+1 distinct chunks.",
            "A chunk travels only to the next process in the ring on each step.",
            "No process ever overwrites a chunk it already holds.",
        ],
        correctness:
            "Process i starts with chunk i. Inductively, at the start of step k it has chunks i, i-1, ..., i-k+1 and sends chunk i-k to process i+1. After p-1 steps the sent chunks cover all p indices, so every process holds exactly the full ordered collection.",
        complexityRationale:
            "There are exactly p-1 rounds, each moving one chunk of m elements per process, so the communication cost is O(p) steps and O(p*m) data per process. Storing the gathered result takes O(p*m) space.",
        uses: [
            "Distributed training parameter collection",
            "MPI MPI_Allgather and NCCL all-gather primitives",
            "Gathering sharded results before a final sequential pass",
        ],
        references: [
            "Geijn and Watts, Collective Communication: Theory, Practice, and Experience, 1997",
            "MPI Forum, MPI: A Message-Passing Interface Standard, Chapter 7",
        ],
        workedExample:
            "Four processes hold chunks [1,2], [3,4], [5,6], and [7,8]. Step 1 sends each process's own chunk rightward; step 2 sends the newly received chunk; step 3 repeats. After three steps every process holds [1,2,3,4,5,6,7,8] in order.",
    },
    id: "ring-allgather",
    name: "Ring All-Gather",
    category: "parallel-distributed",
    complexity: { time: "O(p) steps", space: "O(p*m)" },
    defaultInput: {
        chunks: [
            [1, 2],
            [3, 4],
            [5, 6],
            [7, 8],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "place p processes in a ring, each holding one chunk",
        "for step k from 0 to p minus 2",
        "each process sends chunk i minus k to the next process",
        "each process records the chunk it just received",
        "after p minus 1 steps every chunk has reached every process",
        "assemble the chunks in their original index order",
        "done: report the gathered data",
    ],
};

export default module;
