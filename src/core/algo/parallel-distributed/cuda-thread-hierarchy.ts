/**
 * cuda-thread-hierarchy.ts - CUDA Thread Hierarchy and Warp Reduction
 *
 * Models the grid-block-thread-warp hierarchy: a global thread id is computed
 * from the block and thread indices, threads are grouped into warps, a toy
 * divergent branch marks the active lanes, and a butterfly reduction sums the
 * values held by one warp's lanes.
 *
 * Time:  O(totalThreads) to map indices; O(warpSize log warpSize) per reduction
 * Space: O(totalThreads) for the simulated thread values
 *
 * Visualization: a grid of thread cells is laid out as blocks by threads; the
 * active warp glows during reduction and the final frame reports each sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type WarpResult = { block: number; warp: number; sum: number; activeLanes: number[] };

/** Butterfly reduction over one warp's lane values. Exported for brute checks. */
export function warpReduce(values: number[]): { result: number; steps: number[][] } {
    const work = values.slice();
    const steps: number[][] = [];
    const n = work.length;
    if (n === 0) return { result: 0, steps };
    let offset = 1;
    while (offset * 2 < n) offset *= 2;
    while (offset >= 1) {
        for (let lane = 0; lane + offset < n; lane += 1) {
            work[lane] = (work[lane] as number) + (work[lane + offset] as number);
        }
        steps.push(work.slice());
        offset = Math.floor(offset / 2);
    }
    return { result: work[0] as number, steps };
}

/** Serialize warp results into meta-friendly strings. */
function serializeResults(results: WarpResult[]): string[] {
    return results.map((r) => `${r.block}:${r.warp}:${r.sum}:${r.activeLanes.join("|")}`);
}

/** Build thread cells for the whole grid. */
function makeCells(
    gridDim: number,
    blockDim: number,
    warpSize: number,
    globalIds: number[],
    highlight: Set<number> | null,
    active: Set<number> | null,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let block = 0; block < gridDim; block += 1) {
        for (let thread = 0; thread < blockDim; thread += 1) {
            const global = block * blockDim + thread;
            let state: EntityState = "idle";
            if (highlight?.has(global)) state = active?.has(global) ? "comparing" : "unvisited";
            cells.push({
                id: `thread-${global}`,
                type: "cell" as const,
                label: String(globalIds[global] ?? global),
                value: globalIds[global] ?? global,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    row: block,
                    col: thread,
                    globalId: global,
                    warpId: Math.floor(thread / warpSize),
                    lane: thread % warpSize,
                },
            });
        }
    }
    return cells;
}

/** The CUDA hierarchy generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { gridDim?: number; blockDim?: number; warpSize?: number; values?: number[] } | null) ?? {};
    const gridDim = typeof task.gridDim === "number" && task.gridDim > 0 ? Math.floor(task.gridDim) : 2;
    const blockDim = typeof task.blockDim === "number" && task.blockDim > 0 ? Math.floor(task.blockDim) : 8;
    const warpSize = typeof task.warpSize === "number" && task.warpSize > 0 ? Math.floor(task.warpSize) : 4;
    const total = gridDim * blockDim;
    const values: number[] = Array.isArray(task.values) && task.values.length === total
        ? task.values.map((v) => Number(v) || 0)
        : Array.from({ length: total }, (_, i) => i + 1);
    const globalIds = Array.from({ length: total }, (_, i) => i);
    const results: WarpResult[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(gridDim, blockDim, warpSize, globalIds, null, null),
        edges: [],
        description: `Grid of ${gridDim} block(s) x ${blockDim} thread(s) = ${total} threads, grouped into warps of ${warpSize}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: gridDim, cols: blockDim, gridDim, blockDim, warpSize, total, results: [] },
    };
    step += 1;

    for (let block = 0; block < gridDim; block += 1) {
        const warps = Math.ceil(blockDim / warpSize);
        for (let warp = 0; warp < warps; warp += 1) {
            const lanes: number[] = [];
            const laneValues: number[] = [];
            const first = warp * warpSize;
            const last = Math.min((warp + 1) * warpSize, blockDim);
            for (let thread = first; thread < last; thread += 1) {
                lanes.push(block * blockDim + thread);
                laneValues.push(values[block * blockDim + thread] ?? 0);
            }
            const activeLanes = lanes.filter((_, k) => k % 2 === 0);
            const activeSet = new Set(activeLanes);
            const highlight = new Set(lanes);
            const reduced = warpReduce(laneValues);

            yield {
                stepNumber: step,
                entities: makeCells(gridDim, blockDim, warpSize, globalIds, highlight, activeSet),
                edges: [],
                description: `Block ${block}, warp ${warp}: divergent branch keeps ${activeLanes.length} of ${lanes.length} lanes active.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: {
                    rows: gridDim,
                    cols: blockDim,
                    gridDim,
                    blockDim,
                    warpSize,
                    total,
                    block,
                    warp,
                    lanes,
                    activeLanes,
                    results: serializeResults(results),
                },
            };
            step += 1;

            yield {
                stepNumber: step,
                entities: makeCells(gridDim, blockDim, warpSize, globalIds, highlight, activeSet),
                edges: [],
                description: `Warp ${warp} butterfly reduction over [${laneValues.join(", ")}] yields ${reduced.result}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    rows: gridDim,
                    cols: blockDim,
                    gridDim,
                    blockDim,
                    warpSize,
                    total,
                    block,
                    warp,
                    lanes,
                    steps: reduced.steps.map((row) => row.join(",")),
                    result: reduced.result,
                    results: serializeResults(results),
                },
            };
            step += 1;

            results.push({ block, warp, sum: reduced.result, activeLanes });
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(gridDim, blockDim, warpSize, globalIds, null, null),
        edges: [],
        description: `Hierarchy complete: ${results.length} warp reduction(s) computed from ${total} global thread ids.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: gridDim, cols: blockDim, gridDim, blockDim, warpSize, total, results: serializeResults(results) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A CUDA program launches a grid of blocks, each holding threads, and groups threads into warps that execute one instruction in lockstep. A thread's global id is block index times block size plus its local index. Because a warp runs in SIMT fashion, a branch that only some lanes take serializes the warp, and reductions are done by shuffling values between lanes instead of through shared memory.",
        invariants: [
            "globalId = blockIdx * blockDim + threadIdx for every thread.",
            "warpId = floor(threadIdx / warpSize) and lane = threadIdx modulo warpSize.",
            "The butterfly reduction sums exactly the values held by a warp's lanes.",
        ],
        correctness:
            "The global id formula assigns each (block, thread) pair a distinct integer in 0..totalThreads-1, so the mapping is a bijection. Grouping consecutive threads by floor division gives warps whose lane numbers are contiguous. In each butterfly step, lane k adds the value of lane k + offset with offset halving each round; after offsets reach 1, lane 0 holds the sum of every lane because each value is added into it exactly once along the reduction tree.",
        complexityRationale:
            "Mapping all threads is O(totalThreads), and each warp reduction performs one add per active lane per offset level, O(warpSize log warpSize). Storing thread values, ids, and per-warp results is O(totalThreads) space.",
        uses: [
            "Indexing threads in CUDA and HIP GPU kernels",
            "Warp-level reductions in deep-learning frameworks",
            "Teaching SIMT execution and branch divergence",
        ],
        references: [
            "NVIDIA, CUDA C Programming Guide, Programming Model chapter",
            "Kirk and Hwu, Programming Massively Parallel Processors, Chapter 3",
        ],
        workedExample:
            "With gridDim 2, blockDim 8, and warpSize 4, block 1 thread 6 has global id 1*8+6 = 14, warp id floor(6/4) = 1, lane 6 mod 4 = 2. Warp 1 of block 1 holds threads 4 through 7; its butterfly reduction adds lanes 0+2 and 1+3, then lane 0+1, leaving the sum of those four values in lane 0.",
    },
    id: "cuda-thread-hierarchy",
    name: "CUDA Thread Hierarchy",
    category: "parallel-distributed",
    complexity: { time: "O(N + W log W)", space: "O(N)" },
    defaultInput: { gridDim: 2, blockDim: 8, warpSize: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "read grid dimension block dimension and warp size",
        "for each block compute its thread base index",
        "for each thread compute global id warp id and lane",
        "group consecutive threads into warps of warpSize lanes",
        "apply the divergent branch to build the active lane mask",
        "butterfly add lane k plus lane k+offset while halving offset",
        "store the sum left in lane zero for each warp",
        "done: report every global id and warp reduction",
    ],
};

export default module;
