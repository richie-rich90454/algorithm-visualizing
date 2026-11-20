/**
 * parallel-quicksort.ts - Task-Based Parallel Quick Sort (Deterministic Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Parallel quick sort creates a partition task for the whole array, then
 * recursively creates tasks for the two subranges around each pivot. Tasks are
 * handed to workers from a shared queue; whenever a worker finishes a range it
 * publishes the new tasks and takes the next one. This module simulates that
 * scheduling deterministically with a round-robin task assignment so the
 * replay is reproducible.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * The simulation is sequential in wall-clock terms but records which worker
 * owns each partition task. It does not model true concurrency, memory
 * contention, or load-balancing races; the partition logic itself is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) expected partition work, O(log n) critical path
 *   Space: O(n) for the array and the task queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are array elements; the pivot is purple and scanned items yellow.
 *   - Bars in a finalized position are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type SortInput = { array?: number[]; workers?: number };
type Task = { lo: number; hi: number; worker: number; depth: number };

function makeBars(
    arr: number[],
    pivotIndex: number,
    range: Task | null,
    finalized: Set<number>,
): VisualEntity[] {
    return arr.map((value, index) => {
        let state: EntityState = "idle";
        if (finalized.has(index)) {
            state = "sorted";
        } else if (index === pivotIndex && pivotIndex >= 0) {
            state = "pivot";
        } else if (range && index >= range.lo && index <= range.hi) {
            state = "comparing";
        }
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
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SortInput | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [7, 2, 9, 4, 1, 6, 3, 8, 5, 0];
    const workers = typeof task.workers === "number" ? Math.max(1, Math.min(16, task.workers)) : 4;

    const finalized = new Set<number>();
    const queue: Task[] = [{ lo: 0, hi: arr.length - 1, worker: 0, depth: 0 }];
    let nextWorker = 1;
    let comparisons = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr, -1, null, finalized),
        edges: [],
        description: `Parallel quick sort on ${arr.length} elements with ${workers} worker(s) and one initial task.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { workers, pivotIndex: -1, comparisons, pending: queue.length, worker: 0 },
    };
    step += 1;

    while (queue.length > 0) {
        const current = queue.shift() as Task;
        const { lo, hi } = current;
        if (lo > hi) {
            continue;
        }
        if (lo === hi) {
            finalized.add(lo);
            continue;
        }

        const pivot = arr[hi] as number;
        let store = lo;
        for (let j = lo; j < hi; j += 1) {
            comparisons += 1;
            if ((arr[j] as number) <= pivot) {
                const tmp = arr[store] as number;
                arr[store] = arr[j] as number;
                arr[j] = tmp;
                store += 1;
            }
        }
        const swapTmp = arr[store] as number;
        arr[store] = arr[hi] as number;
        arr[hi] = swapTmp;
        finalized.add(store);

        if (lo < store - 1) {
            queue.push({ lo, hi: store - 1, worker: nextWorker % workers, depth: current.depth + 1 });
            nextWorker += 1;
        }
        if (store + 1 < hi) {
            queue.push({ lo: store + 1, hi, worker: nextWorker % workers, depth: current.depth + 1 });
            nextWorker += 1;
        }

        yield {
            stepNumber: step,
            entities: makeBars(arr, store, current, finalized),
            edges: [],
            description: `Worker ${current.worker} partitioned range ${lo}..${hi} around pivot ${pivot}; pivot settled at ${store}, ${queue.length} task(s) pending.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                workers,
                pivotIndex: store,
                comparisons,
                pending: queue.length,
                worker: current.worker,
                depth: current.depth,
                lo,
                hi,
            },
        };
        step += 1;
    }

    for (let i = 0; i < arr.length; i += 1) {
        finalized.add(i);
    }
    yield {
        stepNumber: step,
        entities: makeBars(arr, -1, null, finalized),
        edges: [],
        description: `All tasks finished: ${arr.length} elements sorted using ${workers} worker(s) and ${comparisons} comparisons.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { workers, pivotIndex: -1, comparisons, pending: 0, sorted: true, result: [...arr] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quick sort is naturally parallel: once a pivot splits the array, the left and right halves are independent. Put those ranges into a shared task queue and let workers claim them. Adding more workers shortens the critical path without changing which elements each partition places.",
        invariants: [
            "Each task's range is disjoint from every other queued task's range.",
            "After a partition, the pivot sits at its final sorted position.",
            "Together with the pivot, queued ranges cover all unsorted elements.",
        ],
        correctness:
            "The partition step is the same Lomuto partition used by sequential quick sort, so it places the pivot at its final index and puts smaller elements to its left and larger ones to its right. Tasks never overlap, so processing them in any order produces the same sorted array as the sequential algorithm.",
        complexityRationale:
            "On balanced partitions the recursion tree has depth O(log n), which is the parallel critical path; the total partition work across all tasks is O(n log n) expected. The array and task queue occupy O(n) space.",
        uses: [
            "Sorting large arrays on multicore processors",
            "Parallel database sort and external sort stages",
            "Teaching task-queue scheduling with a familiar algorithm",
        ],
        references: [
            "Blelloch, Programming Parallel Algorithms, 1996",
            "Cormen et al., Introduction to Algorithms, Chapter 7 and Chapter 27",
        ],
        workedExample:
            "With array [7,2,9,4] and two workers, the first task partitions around pivot 4 into [2] and [9,7], assigning the two ranges to different workers. Each worker partitions its own range, and the combined result is [2,4,7,9].",
    },
    id: "parallel-quicksort",
    name: "Parallel Quick Sort (Task Queue)",
    category: "parallel-distributed",
    complexity: { time: "O(n log n) work, O(log n) depth", space: "O(n)" },
    defaultInput: { array: [7, 2, 9, 4, 1, 6, 3, 8, 5, 0], workers: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "push the whole array as one partition task",
        "while the task queue is not empty",
        "a worker takes a task and partitions its range",
        "place the pivot at its final position",
        "enqueue the left and right subranges as new tasks",
        "mark a range of one element as finished",
        "when no tasks remain the array is sorted",
        "done: report the sorted array",
    ],
};

export default module;
