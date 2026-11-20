/**
 * deap.ts - Deap (double-ended heap)
 *
 * A deap is a priority queue that serves both ends: it supports insert,
 * find-min, find-max, delete-min, and delete-max in logarithmic time. This
 * implementation keeps each element in two linked binary heaps, one ordered
 * ascending and one descending, with stored positions so removing from one
 * heap can delete the twin entry from the other in O(log n).
 *
 * Time:  O(log n) insert and delete, O(1) find of either extreme
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Item {
    id: number;
    value: number;
    mp: number;
    xp: number;
}

function swap(heap: Item[], i: number, j: number, field: "mp" | "xp"): void {
    const a = heap[i];
    const b = heap[j];
    if (!a || !b) return;
    heap[i] = b;
    heap[j] = a;
    a[field] = j;
    b[field] = i;
}

function siftUp(heap: Item[], pos: number, min: boolean, field: "mp" | "xp"): void {
    let at = pos;
    while (at > 0) {
        const parent = (at - 1) >> 1;
        const cur = heap[at]?.value ?? 0;
        const par = heap[parent]?.value ?? 0;
        if (min ? cur >= par : cur <= par) break;
        swap(heap, parent, at, field);
        at = parent;
    }
}

function siftDown(heap: Item[], pos: number, min: boolean, field: "mp" | "xp"): void {
    let at = pos;
    const n = heap.length;
    while (true) {
        let best = at;
        for (const child of [2 * at + 1, 2 * at + 2]) {
            if (child >= n) continue;
            const cv = heap[child]?.value ?? 0;
            const bv = heap[best]?.value ?? 0;
            if (min ? cv < bv : cv > bv) best = child;
        }
        if (best === at) break;
        swap(heap, at, best, field);
        at = best;
    }
}

function removeAt(heap: Item[], pos: number, min: boolean, field: "mp" | "xp"): Item | undefined {
    const item = heap[pos];
    const last = heap.pop();
    if (!item || !last) return item ?? last;
    if (pos < heap.length) {
        heap[pos] = last;
        last[field] = pos;
        siftUp(heap, pos, min, field);
        siftDown(heap, pos, min, field);
    }
    item[field] = -1;
    return item;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; mins?: number; maxs?: number } | null) ?? {};
    const keys = Array.isArray(task.keys) && task.keys.length > 0 ? [...task.keys] : [5, 2, 9, 1, 7, 3];
    const mins = typeof task.mins === "number" ? Math.max(0, task.mins) : 2;
    const maxs = typeof task.maxs === "number" ? Math.max(0, task.maxs) : 2;

    const minHeap: Item[] = [];
    const maxHeap: Item[] = [];
    let nextId = 0;
    let step = 0;
    const poppedMin: number[] = [];
    const poppedMax: number[] = [];

    const cells = (hot: number): VisualEntity[] => {
        const rows: Item[][] = [minHeap, maxHeap];
        const out: VisualEntity[] = [];
        rows.forEach((heap, row) => {
            heap.forEach((item, col) => {
                out.push({
                    id: `${row === 0 ? "mn" : "mx"}-${item.id}`,
                    type: "cell" as const,
                    label: String(item.value),
                    value: item.value,
                    state: (item.id === hot ? "comparing" : col === 0 ? "pivot" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col, value: item.value, itemId: item.id },
                });
            });
        });
        if (out.length === 0) {
            out.push({
                id: "deap-empty",
                type: "cell" as const,
                label: "(empty)",
                value: 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return out;
    };

    const frame = (hot: number, message: string, line: number, extra: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: cells(hot),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                min: minHeap[0]?.value ?? -1,
                max: maxHeap[0]?.value ?? -1,
                size: minHeap.length,
                poppedMin: [...poppedMin],
                poppedMax: [...poppedMax],
                ...extra,
            },
        };
        step += 1;
        return result;
    };

    yield frame(-1, "Empty deap: top row is the min-heap, bottom row is the max-heap.", 0, {});

    for (const value of keys) {
        const item: Item = { id: nextId, value, mp: 0, xp: 0 };
        nextId += 1;
        minHeap.push(item);
        item.mp = minHeap.length - 1;
        siftUp(minHeap, item.mp, true, "mp");
        maxHeap.push(item);
        item.xp = maxHeap.length - 1;
        siftUp(maxHeap, item.xp, false, "xp");
        yield frame(item.id, `Inserted ${value} into both linked heaps.`, 1, { last: value });
    }

    for (let k = 0; k < mins; k += 1) {
        const item = removeAt(minHeap, 0, true, "mp");
        if (!item) break;
        removeAt(maxHeap, item.xp, false, "xp");
        poppedMin.push(item.value);
        yield frame(item.id, `delete-min removed ${item.value}; its twin left the max-heap too.`, 4, { last: item.value });
    }

    for (let k = 0; k < maxs; k += 1) {
        const item = removeAt(maxHeap, 0, false, "xp");
        if (!item) break;
        removeAt(minHeap, item.mp, true, "mp");
        poppedMax.push(item.value);
        yield frame(item.id, `delete-max removed ${item.value}; its twin left the min-heap too.`, 6, { last: item.value });
    }

    const remaining = minHeap.map((item) => item.value).sort((a, b) => a - b);
    yield frame(
        -1,
        `Extremes removed: mins [${poppedMin.join(", ")}], maxes [${poppedMax.join(", ")}].`,
        8,
        { remaining, size: minHeap.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A deap answers questions about both the smallest and largest element. It pairs a min-heap and a max-heap and makes each inserted element appear in both, with each copy remembering where its twin lives. Removing an extreme takes the root of one heap and uses the stored position to delete the matching copy from the other, so both ends stay correct.",
        invariants: [
            "The min-heap root is the smallest stored key and the max-heap root is the largest.",
            "Every element has exactly one live copy in each heap at matching positions.",
            "Both heaps satisfy their own ordering after every insert and delete, restored by sift up or sift down.",
        ],
        correctness:
            "Insertion pushes the same item into both heaps and restores each heap's ordering, so both roots are correct. delete-min removes the true minimum from the min-heap and, via the stored position, the identical item from the max-heap; the same argument applies symmetrically to delete-max. Because both copies are always removed together, the two heaps represent the same multiset and every subsequent extreme is computed from the true remaining keys.",
        complexityRationale:
            "Each heap holds n items, so space is O(n). Insert and delete perform a sift along a root-to-leaf path in one heap and a constant-time position lookup plus a sift in the other, each O(log n), while finding either extreme reads a root in O(1).",
        uses: [
            "Double-ended priority queues in event simulations with both earliest and latest events",
            "Sliding-window min and max trackers in streaming statistics",
            "Branch-and-bound solvers that prune from either the best or worst bound",
        ],
        references: [
            "Carlsson, The Deap: A Double-Ended Heap, 1987",
            "Cormen et al., Introduction to Algorithms, Chapter 6 on heaps",
        ],
        workedExample:
            "Inserting 5, 2, 9, 1, 7, 3 puts 1 at the min-heap root and 9 at the max-heap root. delete-min removes 1 and deletes its twin from the max-heap; delete-min again removes 2. A delete-max then removes 9 and its twin from the min-heap, followed by 7. The remaining keys are 3 and 5.",
    },
    id: "deap",
    name: "Deap",
    category: "data-structures",
    complexity: { time: "O(log n) delete", space: "O(n)" },
    defaultInput: { keys: [5, 2, 9, 1, 7, 3], mins: 2, maxs: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "create an empty min-heap and an empty max-heap",
        "for each key insert a shared item into both heaps",
        "sift the item upward in the min-heap by value",
        "sift the same item upward in the max-heap by value",
        "to remove the minimum pop the min-heap root",
        "delete that same item from the max-heap by its stored position",
        "to remove the maximum pop the max-heap root",
        "delete that same item from the min-heap by its stored position",
        "report the extracted extremes and the remaining keys",
    ],
};

export default module;
