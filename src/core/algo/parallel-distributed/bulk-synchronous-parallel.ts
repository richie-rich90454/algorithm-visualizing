/**
 * bulk-synchronous-parallel.ts - Bulk Synchronous Parallel Prefix Scan
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bulk Synchronous Parallel (BSP) model organizes a computation into
 * supersteps. In each superstep every processor performs local work, then the
 * processors exchange messages, and finally a barrier synchronization makes
 * all messages visible before the next superstep begins.
 *
 * This module demonstrates the model with a distributed prefix scan. The array
 * is split into contiguous blocks, one per processor. Superstep one computes a
 * local sum per block. Superstep two exchanges those sums and, after a barrier,
 * gives each block the exclusive prefix of earlier blocks. Superstep three runs
 * a local scan in each block and adds its offset. The result equals the ordinary
 * sequential prefix sum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n / P + P) across three supersteps for n values and P processors
 *   Space: O(n / P) local storage per processor
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per array value, with the owning processor in metadata.
 *   - The block active in the current superstep is highlighted.
 *   - Barriers, messages, and the running prefix are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BspSuperstep {
    index: number;
    name: string;
    messages: number;
    barrier: boolean;
}

export interface BspPrefixResult {
    chunks: number[][];
    owners: number[];
    totals: number[];
    offsets: number[];
    result: number[];
    supersteps: BspSuperstep[];
}

/** Inclusive sequential prefix sum used as the reference answer. */
export function sequentialPrefix(values: number[]): number[] {
    const result: number[] = [];
    let running = 0;
    for (const value of values) {
        running += value;
        result.push(running);
    }
    return result;
}

/** Partition values into at most processors contiguous blocks. */
function partition(values: number[], processors: number): number[][] {
    const p = Math.max(1, Math.min(processors, values.length || 1));
    const chunks: number[][] = Array.from({ length: p }, () => []);
    for (let i = 0; i < values.length; i += 1) {
        chunks[Math.floor((i * p) / values.length)]!.push(values[i] ?? 0);
    }
    return chunks;
}

/** Full three-superstep BSP distributed prefix scan. */
export function bspPrefixScan(values: number[], processors: number): BspPrefixResult {
    const chunks = partition(values, processors);
    const owners: number[] = [];
    chunks.forEach((chunk, proc) => chunk.forEach(() => owners.push(proc)));

    // Superstep 1: each processor reduces its block locally.
    const totals = chunks.map((chunk) => chunk.reduce((sum, value) => sum + value, 0));

    // Superstep 2: exchange totals; after the barrier each block learns the
    // exclusive prefix of the totals of all preceding blocks.
    const offsets: number[] = [];
    let before = 0;
    for (let proc = 0; proc < chunks.length; proc += 1) {
        offsets.push(before);
        before += totals[proc] ?? 0;
    }

    // Superstep 3: local scan inside each block plus its offset.
    const result: number[] = [];
    chunks.forEach((chunk, proc) => {
        let running = offsets[proc] ?? 0;
        for (const value of chunk) {
            running += value;
            result.push(running);
        }
    });

    const p = chunks.length;
    const supersteps: BspSuperstep[] = [
        { index: 1, name: "local reduce", messages: 0, barrier: true },
        { index: 2, name: "all-gather totals", messages: p * (p - 1), barrier: true },
        { index: 3, name: "local scan", messages: 0, barrier: true },
    ];
    return { chunks, owners, totals, offsets, result, supersteps };
}

/** Build bars whose values show the currently visible prefix. */
function makeBars(
    values: number[],
    owners: number[],
    activeProcessor: number,
    done: boolean,
): VisualEntity[] {
    return values.map((value, index) => {
        const owner = owners[index] ?? 0;
        const state: EntityState = done
            ? "sorted"
            : owner === activeProcessor
              ? "comparing"
              : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, processor: owner },
        };
    });
}

/** Shared metadata fields for a frame. */
function baseMeta(result: BspPrefixResult, superstep: number, messages: number): Record<string, number | string | boolean | number[]> {
    return {
        processors: result.chunks.length,
        superstep,
        barriers: superstep,
        messages,
        totals: result.totals,
        offsets: result.offsets,
    };
}

/** The BSP prefix scan generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; processors?: number } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => (typeof v === "number" ? v : 0))
        : [1, 2, 3, 4, 5, 6, 7, 8];
    const processors = typeof task.processors === "number" ? Math.floor(task.processors) : 4;
    const result = bspPrefixScan(values, processors);
    const p = result.chunks.length;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(values, result.owners, -1, false),
        edges: [],
        description: `Splitting ${values.length} value(s) across ${p} processor(s) for a BSP prefix scan.`,
        codeLineNumber: 0,
        layout: "array",
        meta: baseMeta(result, 0, 0),
    };

    // Superstep 1: local reduce.
    for (let proc = 0; proc < p; proc += 1) {
        yield {
            stepNumber: step++,
            entities: makeBars(values, result.owners, proc, false),
            edges: [],
            description: `Superstep 1, processor ${proc}: local sum of its block is ${result.totals[proc]}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...baseMeta(result, 1, 0), activeProcessor: proc },
        };
    }

    // Superstep 2: communicate totals and synchronize at the barrier.
    yield {
        stepNumber: step++,
        entities: makeBars(values, result.owners, -1, false),
        edges: [],
        description: `Superstep 2: all-gather of ${p} local sum(s) using ${result.supersteps[1]!.messages} message(s), then barrier; offsets are ${result.offsets.join(", ")}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: baseMeta(result, 2, result.supersteps[1]!.messages),
    };

    // Superstep 3: local scan, revealing the visible prefix block by block.
    const visible = [...values];
    for (let proc = 0; proc < p; proc += 1) {
        const chunk = result.chunks[proc]!;
        let start = 0;
        for (let i = 0; i < result.owners.length; i += 1) {
            if (result.owners[i] === proc) {
                start = i;
                break;
            }
        }
        const offset = result.offsets[proc] ?? 0;
        let running = offset;
        for (let j = 0; j < chunk.length; j += 1) {
            running += chunk[j] ?? 0;
            visible[start + j] = running;
        }
        yield {
            stepNumber: step++,
            entities: makeBars(visible, result.owners, proc, false),
            edges: [],
            description: `Superstep 3, processor ${proc}: local scan adds offset ${offset}, producing ${chunk.map((_, j) => visible[start + j]).join(", ")}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { ...baseMeta(result, 3, 0), activeProcessor: proc, visible: [...visible] },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.result, result.owners, -1, true),
        edges: [],
        description: `Scan complete after three supersteps: ${result.result.join(", ")}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...baseMeta(result, 3, 0), result: result.result },
    };
}

/** The BSP prefix scan module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a team split into groups, where each group first works alone, then everyone shares what they found, and only after a synchronization point does anyone use the shared information. A BSP program is a sequence of these supersteps: local computation, communication, barrier. The barrier is what makes the model predictable, because no processor races ahead into the next superstep.",
        invariants: [
            "Within a superstep, no processor reads a message sent during that same superstep.",
            "At a barrier, all messages from the superstep become visible to every processor.",
            "The offset added to a block equals the sum of all preceding blocks' totals.",
        ],
        correctness:
            "Each block's total is the sum of its values, so the exclusive prefix of totals is the sum of every value in preceding blocks. Adding that offset to the inclusive local scan of a block yields the sum of all values from the start of the array through that position. Since the blocks partition the array in order, the concatenated result is exactly the sequential prefix sum, which the implementation reproduces directly.",
        complexityRationale:
            "Local reduce and local scan touch each of the n values once, so they cost O(n / P) per processor. The all-gather sends P totals to P processors, O(P) messages, and there are three barriers. Total work is O(n / P + P) per processor with O(n / P) local storage.",
        uses: [
            "Parallel primitives inside collective communication libraries",
            "Prefix sums for parallel sorting and scan-based algorithms",
            "A teaching model for synchronization and communication costs",
        ],
        references: [
            "Valiant, A Bridging Model for Parallel Computation, Communications of the ACM, 1990",
            "Skillicorn, Hill, and McColl, The BSP Model, 1997",
        ],
        workedExample:
            "With values 1 through 8 on four processors, the blocks are [1,2], [3,4], [5,6], [7,8] with totals 3, 7, 11, 15. The offsets after the barrier are 0, 3, 10, 21, and the local scans give the global prefix sums 1, 3, 6, 10, 15, 21, 28, 36.",
    },
    id: "bulk-synchronous-parallel",
    name: "Bulk Synchronous Parallel Prefix Scan",
    category: "parallel-distributed",
    complexity: { time: "O(n/P + P)", space: "O(n/P)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8], processors: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "partition the array into one contiguous block per processor",
        "superstep one: each processor locally sums its block",
        "barrier: make every local sum visible",
        "superstep two: all-gather the sums and compute each block's offset",
        "barrier: ensure all offsets are known before proceeding",
        "superstep three: each processor scans its block and adds its offset",
        "barrier: make the final block results visible",
        "done: concatenate the blocks into the global prefix sum",
    ],
};

export default module;
