/**
 * scatter-gather.ts - Scatter-Gather Collective Communication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Scatter-gather is a collective operation over a group of processes. In the
 * scatter phase the root splits a single array into equal contiguous chunks and
 * sends one chunk to each worker. After optional local work, the gather phase
 * sends the chunks back and the root concatenates them in worker order,
 * reconstructing a result aligned with the original indexing. It is the
 * building block of distributed matrix multiplication, reductions, and map
 * style data parallel jobs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) message volume for m elements, with O(P) message starts
 *   Space: O(m) across the root and workers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The root sits at the center and workers form a ring around it.
 *   - The active star edge lights up as each chunk is sent or received.
 *   - meta carries the data, chunks, assembled result, and phase flags.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

function makeNodes(
    processes: number,
    workerData: number[][],
    active: number,
    rootHolds: boolean,
): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    nodes.push({
        id: "node-root",
        type: "node",
        label: `Root${rootHolds ? " (all)" : " (assembling)"}`,
        value: workerData.flat(),
        state: active === -1 ? "active" : "visited",
        x: 300,
        y: 300,
        width: 0,
        height: 0,
        metadata: { index: -1, role: "root", size: workerData.flat().length },
    });
    for (let i = 0; i < processes; i += 1) {
        const angle = (2 * Math.PI * i) / processes - Math.PI / 2;
        const chunk = workerData[i] ?? [];
        let state: EntityState = "unvisited";
        if (active === i) {
            state = "comparing";
        } else if (chunk.length > 0) {
            state = "sorted";
        }
        nodes.push({
            id: `node-w${i}`,
            type: "node",
            label: `W${i} (${chunk.length})`,
            value: chunk.slice(),
            state,
            x: 300 + 190 * Math.cos(angle),
            y: 300 + 190 * Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index: i, role: "worker", size: chunk.length },
        });
    }
    return nodes;
}

function makeEdges(processes: number, active: number, phase: string): VisualEdge[] {
    return Array.from({ length: processes }, (_, index) => ({
        id: `edge-root-w${index}`,
        sourceId: phase === "gather" ? `node-w${index}` : "node-root",
        targetId: phase === "gather" ? "node-root" : `node-w${index}`,
        label: phase === "gather" ? "gather" : "scatter",
        state: index === active ? "path" : "idle",
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; processes?: number } | null) ?? {};
    const raw = Array.isArray(task.data) ? task.data.map((v) => Number(v)) : [];
    const data: number[] = raw.length > 0 ? raw : [1, 2, 3, 4, 5, 6, 7, 8];
    const processes = Math.max(1, Math.min(8, Math.floor(Number(task.processes ?? 4)) || 4));
    const chunkSize = Math.max(1, Math.ceil(data.length / processes));
    const chunks: number[][] = Array.from({ length: processes }, (_, i) =>
        data.slice(i * chunkSize, (i + 1) * chunkSize),
    );
    const workerData: number[][] = Array.from({ length: processes }, () => []);
    const received: number[][] = Array.from({ length: processes }, () => []);

    const metaFor = (phase: string, active: number, assembled: number[], scatterDone: boolean, gatherDone: boolean) => ({
        phase,
        processes,
        activeWorker: active,
        count: data.length,
        chunkSize,
        data: data.slice(),
        chunks: chunks.flat(),
        workerSizes: workerData.map((chunk) => chunk.length),
        assembled: assembled.slice(),
        scatterDone,
        gatherDone,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(processes, workerData, -1, true),
        edges: makeEdges(processes, -1, "setup"),
        description: `Root holds ${data.length} element(s) and will scatter ${processes} contiguous chunk(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: metaFor("setup", -1, [], false, false),
    };
    step += 1;

    for (let i = 0; i < processes; i += 1) {
        workerData[i] = chunks[i]!.slice();
        yield {
            stepNumber: step,
            entities: makeNodes(processes, workerData, i, true),
            edges: makeEdges(processes, i, "scatter"),
            description: `Scatter: root sends chunk ${i} with ${chunks[i]!.length} element(s) to worker ${i}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: metaFor("scatter", i, [], false, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(processes, workerData, -1, false),
        edges: makeEdges(processes, -1, "local"),
        description: "Each worker now owns one disjoint chunk and performs its local computation.",
        codeLineNumber: 3,
        layout: "point",
        meta: metaFor("local", -1, [], true, false),
    };
    step += 1;

    const assembled: number[] = [];
    for (let i = 0; i < processes; i += 1) {
        received[i] = workerData[i]!.slice();
        assembled.push(...received[i]!);
        yield {
            stepNumber: step,
            entities: makeNodes(processes, workerData, i, false),
            edges: makeEdges(processes, i, "gather"),
            description: `Gather: worker ${i} returns its chunk; root appends ${received[i]!.length} element(s) at position ${assembled.length - received[i]!.length}.`,
            codeLineNumber: 5,
            layout: "point",
            meta: metaFor("gather", i, assembled, true, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(processes, workerData, -1, false),
        edges: makeEdges(processes, -1, "complete"),
        description: `Gather complete: the root reassembled ${assembled.length} element(s) in worker order.`,
        codeLineNumber: 6,
        layout: "point",
        meta: metaFor("complete", -1, assembled, true, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single array is too large for one process to work on efficiently, so the root chops it into equal pieces and hands one to each worker. After everyone processes its piece, the pieces come back and the root glues them together in the original order. The only coordination needed is knowing the chunk boundaries, which every process can compute from its rank.",
        invariants: [
            "Chunks are contiguous, disjoint, and together cover the entire input array.",
            "Each worker receives exactly one chunk and returns that same chunk unchanged.",
            "The gathered result concatenates chunks in ascending worker order.",
        ],
        correctness:
            "Chunk i is the slice from i times the chunk size to the end of that slice, so the chunks are disjoint and their concatenation is the original data. Scatter delivers each slice to exactly one worker, and gather appends the returned slices in worker index order. Because the slices partition the original index range in increasing order, concatenating them in that order reproduces the input element for element. This is independent of message arrival timing because the root appends by rank rather than arrival order.",
        complexityRationale:
            "Every element crosses the network twice, once down and once up, so the total message volume is O(m) for m elements with O(P) message headers. The root and workers together hold one copy of the data, giving O(m) space.",
        uses: [
            "Distributed matrix and vector operations in MPI programs",
            "MapReduce style data partitioning and result collection",
            "Parallel sorting and numerical solvers that split work by index range",
        ],
        references: [
            "Gropp, Lusk, and Skjellum, Using MPI, Chapter 3",
            "Barney, Introduction to Parallel Computing, collective operations section",
        ],
        workedExample:
            "Eight values split among four workers give chunks [1,2], [3,4], [5,6], [7,8]. The root sends each chunk out, then gathers them back in worker order. Concatenating [1,2], [3,4], [5,6], and [7,8] reconstructs the original eight values exactly.",
    },
    id: "scatter-gather",
    name: "Scatter-Gather",
    category: "parallel-distributed",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { data: [1, 2, 3, 4, 5, 6, 7, 8], processes: 4 },
    visualType: "point",
    run,
    pseudocode: [
        "root splits the data into equal contiguous chunks",
        "for each worker send the chunk indexed by its rank",
        "each worker processes its local chunk",
        "prepare an empty assembled buffer at the root",
        "for each worker receive its returned chunk in rank order",
        "append the returned chunk to the assembled buffer",
        "after all workers report the buffer holds the result",
        "done: the gathered array matches the original ordering",
    ],
};

export default module;
