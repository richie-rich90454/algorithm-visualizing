/**
 * parallel-merge-sort.ts - Parallel Merge Sort (task simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Parallel merge sort divides an array into chunks, sorts every chunk
 * independently, and then merges adjacent sorted chunks in rounds. All merges
 * in one round are independent and can run on different workers at the same
 * time, so the critical path is logarithmic in the number of chunks rather
 * than linear. This visualization schedules the parallel work deterministically
 * and shows one frame per concurrent operation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) total work, O(log n) parallel merge rounds with n workers
 *   Space: O(n) for the working array and the merge buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Array elements are bars; chunk and run boundaries are reported in meta.
 *   - The chunk or run currently being produced is yellow (comparing).
 *   - Completed and untouched runs are green (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Run = [number, number];

function makeBars(values: number[], active: Run | null = null): VisualEntity[] {
    const activeSet = new Set<number>();
    if (active) {
        for (let i = active[0]; i < active[1]; i += 1) activeSet.add(i);
    }
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: activeSet.has(index) ? "comparing" : "sorted",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Sequential insertion sort used inside one worker's chunk. */
function insertionSort(values: number[], start: number, end: number): number {
    let comparisons = 0;
    for (let i = start + 1; i < end; i += 1) {
        const value = values[i] ?? 0;
        let j = i - 1;
        while (j >= start && (values[j] ?? 0) > value) {
            comparisons += 1;
            values[j + 1] = values[j] ?? 0;
            j -= 1;
        }
        comparisons += 1;
        values[j + 1] = value;
    }
    return comparisons;
}

/** Stable two-pointer merge of two adjacent sorted runs into a buffer. */
function mergeRun(values: number[], left: Run, right: Run): { merged: number[]; comparisons: number } {
    let i = left[0];
    let j = right[0];
    const merged: number[] = [];
    let comparisons = 0;
    while (i < left[1] && j < right[1]) {
        comparisons += 1;
        if ((values[i] ?? 0) <= (values[j] ?? 0)) {
            merged.push(values[i] ?? 0);
            i += 1;
        } else {
            merged.push(values[j] ?? 0);
            j += 1;
        }
    }
    while (i < left[1]) {
        merged.push(values[i] ?? 0);
        i += 1;
    }
    while (j < right[1]) {
        merged.push(values[j] ?? 0);
        j += 1;
    }
    return { merged, comparisons };
}

/** Parallel merge sort generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; workers?: number } | null) ?? {};
    const source = Array.isArray(task.array) ? task.array.map((value) => Number(value) || 0) : [38, 27, 43, 3, 9, 82, 10, 19, 51, 4];
    const workers =
        typeof task.workers === "number" ? Math.max(1, Math.floor(task.workers)) : 4;
    const values = [...source];
    const n = values.length;
    let step = 0;
    let comparisons = 0;

    const frame = (active: Run | null, description: string, line: number, round: number, runs: Run[]): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, active),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: {
            values: [...values],
            runs: runs.flat(),
            round,
            comparisons,
            workers,
        },
    });

    if (n === 0) {
        yield frame(null, "Empty array - nothing to sort.", 6, 0, []);
        return;
    }

    const chunkSize = Math.max(1, Math.ceil(n / workers));
    const runs: Run[] = [];
    for (let start = 0; start < n; start += chunkSize) {
        runs.push([start, Math.min(n, start + chunkSize)]);
    }

    yield frame(null, `Split ${n} elements into ${runs.length} chunks for ${workers} worker(s).`, 0, 0, runs);
    step += 1;

    for (const chunk of runs) {
        comparisons += insertionSort(values, chunk[0], chunk[1]);
        yield frame(chunk, `Worker sorts chunk [${chunk[0]}, ${chunk[1]}) into ascending order.`, 1, 0, runs);
        step += 1;
    }

    let round = 0;
    let current = runs;
    while (current.length > 1) {
        const next: Run[] = [];
        for (let i = 0; i < current.length; i += 2) {
            const left = current[i];
            const right = current[i + 1];
            if (!left) continue;
            if (!right) {
                next.push(left);
                continue;
            }
            const { merged, comparisons: used } = mergeRun(values, left, right);
            comparisons += used;
            for (let k = 0; k < merged.length; k += 1) values[left[0] + k] = merged[k] ?? 0;
            const combined: Run = [left[0], right[1]];
            next.push(combined);
            const displayed = [...next, ...current.slice(i + 2)];
            yield frame(combined, `Merge round ${round + 1}: combine runs [${left[0]}, ${left[1]}) and [${right[0]}, ${right[1]}).`, 3, round + 1, displayed);
            step += 1;
        }
        current = next;
        yield frame(null, `Round ${round + 1} complete: ${current.length} sorted run(s) remain.`, 4, round + 1, current);
        step += 1;
        round += 1;
    }

    yield frame([0, n], `All ${n} elements are sorted; the parallel merge produced one run.`, 6, round, current);
}

/** The parallel merge sort module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Sorting is easy to split up: give each worker a slice of the array, let them sort their own slices, then repeatedly merge neighboring sorted slices. Within a merge round every pair is independent, so all those merges can happen at the same time. Only the number of rounds depends on how many slices there are, which is why the parallel depth is small.",
        invariants: [
            "At every point the working array is a permutation of the original elements.",
            "After the chunk phase and after every merge, each run recorded in meta is sorted internally.",
            "Merging two adjacent sorted runs produces one longer sorted run that covers the same positions.",
        ],
        correctness:
            "Insertion sort orders each chunk, so every initial run is sorted. The two-pointer merge of two sorted runs always emits the smaller available head, so its output is sorted and contains exactly the union of the two inputs. By induction every run is sorted after each round. When one run remains it spans the whole array and is sorted, so the result equals a sequential sort.",
        complexityRationale:
            "Sorting chunks and all merge levels do O(n log n) total comparisons, the same order as sequential merge sort. With one worker per chunk the log n merge rounds run concurrently, giving O(log n) parallel depth and O(n) space for the merge buffers.",
        uses: [
            "External sorting of data too large for one machine",
            "Sorting primitives in parallel runtimes and GPU libraries",
            "MapReduce-style pipelines with a sorted reduce phase",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 2",
            "Blelloch, Scans as Primitive Parallel Operations, 1989",
        ],
        workedExample:
            "Split [38, 27, 43, 3, 9, 82, 10, 19, 51, 4] into four chunks of three or fewer. Each chunk is sorted locally: [27, 38, 43], [3, 9, 82], [10, 19, 51], [4]. One merge round pairs them into [3, 9, 27, 38, 43, 82] and [4, 10, 19, 51], and a final merge yields the fully sorted array.",
    },
    id: "parallel-merge-sort",
    name: "Parallel Merge Sort",
    category: "parallel-distributed",
    complexity: { time: "O(n log n) work, O(log n) depth", space: "O(n)" },
    defaultInput: { array: [38, 27, 43, 3, 9, 82, 10, 19, 51, 4], workers: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "split the array into roughly equal chunks, one per worker",
        "sort each chunk independently with a local sort",
        "form adjacent pairs of sorted runs",
        "merge each pair with two pointers into one sorted run",
        "all pairs in a round run concurrently",
        "repeat the merge rounds until a single run remains",
        "done: report the fully sorted array",
    ],
};

export default module;
