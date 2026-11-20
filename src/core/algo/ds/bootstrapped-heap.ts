/**
 * bootstrapped-heap.ts - Bootstrapped Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bootstrapped heap builds a new heap out of an existing heap. Elements are
 * stored in a collection of ordinary binary min heaps, and a second "boot"
 * heap holds one entry per subheap containing that subheap's minimum. Because
 * the boot heap always knows the smallest element of each subheap, find-min
 * and meld are cheap, and delete-min only touches the subheap that supplied
 * the minimum.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Both layers use array based binary min heaps with explicit sift operations.
 * This is the classic bootstrapping idea applied to a simple primitive heap;
 * no Fibonacci heaps, amortized potentials, or concurrent access are modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   insert: O(log n); findMin: O(1); deleteMin: O(log n); meld: O(log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first grid row is the boot heap of subheap minima.
 *   - Later rows are the individual subheaps.
 *   - The extracted minimum and the surviving entries are highlighted.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Entry {
    min: number;
    id: number;
}

const entryLess = (a: Entry, b: Entry): boolean => a.min < b.min || (a.min === b.min && a.id < b.id);

function heapPush(heap: number[], value: number): void {
    heap.push(value);
    let i = heap.length - 1;
    while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if ((heap[parent] ?? 0) <= (heap[i] ?? 0)) {
            break;
        }
        [heap[parent], heap[i]] = [heap[i] ?? 0, heap[parent] ?? 0];
        i = parent;
    }
}

function heapPop(heap: number[]): number | undefined {
    if (heap.length === 0) {
        return undefined;
    }
    const top = heap[0] ?? 0;
    const last = heap.pop() ?? 0;
    if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = i;
            if (left < heap.length && (heap[left] ?? 0) < (heap[smallest] ?? 0)) {
                smallest = left;
            }
            if (right < heap.length && (heap[right] ?? 0) < (heap[smallest] ?? 0)) {
                smallest = right;
            }
            if (smallest === i) {
                break;
            }
            [heap[i], heap[smallest]] = [heap[smallest] ?? 0, heap[i] ?? 0];
            i = smallest;
        }
    }
    return top;
}

function bootPush(boot: Entry[], entry: Entry): void {
    boot.push(entry);
    let i = boot.length - 1;
    while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (!entryLess(entry, boot[parent] ?? { min: Infinity, id: Infinity })) {
            break;
        }
        [boot[parent], boot[i]] = [boot[i] ?? entry, boot[parent] ?? entry];
        i = parent;
    }
}

function bootPop(boot: Entry[]): Entry | undefined {
    if (boot.length === 0) {
        return undefined;
    }
    const top = boot[0] ?? { min: 0, id: 0 };
    const last = boot.pop() ?? top;
    if (boot.length > 0) {
        boot[0] = last;
        let i = 0;
        for (;;) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = i;
            const leftEntry = boot[left] ?? { min: Infinity, id: Infinity };
            const rightEntry = boot[right] ?? { min: Infinity, id: Infinity };
            if (left < boot.length && entryLess(leftEntry, boot[smallest] ?? top)) {
                smallest = left;
            }
            if (right < boot.length && entryLess(rightEntry, boot[smallest] ?? top)) {
                smallest = right;
            }
            if (smallest === i) {
                break;
            }
            [boot[i], boot[smallest]] = [boot[smallest] ?? top, boot[i] ?? top];
            i = smallest;
        }
    }
    return top;
}

function gridEntities(boot: Entry[], subs: Map<number, number[]>, highlight: string): VisualEntity[] {
    const rows: number[][] = [boot.map((entry) => entry.min)];
    const subIds: number[] = [];
    for (const [id] of subs) {
        subIds.push(id);
        rows.push([...(subs.get(id) ?? [])]);
    }
    subIds.sort((a, b) => a - b);
    for (let r = 1; r < rows.length; r += 1) {
        rows[r] = [...(subs.get(subIds[r - 1] ?? 0) ?? [])];
    }
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        row.forEach((value, c) => {
            const id = r === 0 ? `boot-${c}` : `sub-${subIds[r - 1]}-${c}`;
            entities.push({
                id,
                type: "cell" as const,
                label: String(value),
                value,
                state: (id === highlight ? "active" : r === 0 ? "comparing" : "idle") as VisualEntity["state"],
                x: c,
                y: r,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value, layer: r === 0 ? "boot" : "sub" },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.filter((v) => typeof v === "number")
        : [5, 2, 8, 1, 9, 3, 7];

    const boot: Entry[] = [];
    const subs = new Map<number, number[]>();
    let nextId = 0;
    const extracted: number[] = [];
    let step = 0;

    const insertValue = (value: number): void => {
        const id = nextId;
        nextId += 1;
        const sub: number[] = [];
        heapPush(sub, value);
        subs.set(id, sub);
        bootPush(boot, { min: value, id });
    };

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] ?? 0;
        insertValue(value);
        yield {
            stepNumber: step,
            entities: gridEntities(boot, subs, `boot-${boot.findIndex((e) => e.min === value && e.id === nextId - 1)}`),
            edges: [],
            description: `Insert ${value} as a new one-element subheap and add its minimum to the boot heap.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: subs.size + 1, cols: Math.max(1, boot.length), value, subheaps: subs.size },
        };
        step += 1;
    }

    const currentMin = boot[0]?.min ?? 0;
    yield {
        stepNumber: step,
        entities: gridEntities(boot, subs, "boot-0"),
        edges: [],
        description: `Find-min reads the boot heap root ${currentMin}, which is the minimum of every subheap.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: subs.size + 1, cols: Math.max(1, boot.length), findMin: currentMin },
    };
    step += 1;

    while (boot.length > 0) {
        const entry = bootPop(boot);
        if (!entry) {
            break;
        }
        const sub = subs.get(entry.id) ?? [];
        const removed = heapPop(sub);
        subs.delete(entry.id);
        if (sub.length > 0) {
            subs.set(entry.id, sub);
            bootPush(boot, { min: sub[0] ?? 0, id: entry.id });
        }
        extracted.push(removed ?? entry.min);
        yield {
            stepNumber: step,
            entities: gridEntities(boot, subs, ""),
            edges: [],
            description: `Delete-min removes ${removed} from subheap ${entry.id} and, if it still has elements, reinserts its new minimum into the boot heap.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: subs.size + 1,
                cols: Math.max(1, boot.length),
                removed: removed ?? entry.min,
                remainingMin: boot[0]?.min ?? -1,
                extracted: [...extracted],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: gridEntities(boot, subs, ""),
        edges: [],
        description: `All elements extracted in sorted order: ${extracted.join(", ")}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 1, cols: 1, sorted: extracted, count: extracted.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Make a heap whose elements are themselves heaps. Give every small heap one slot in a second heap that remembers only its current minimum. To find the overall smallest element, look at the second heap; to remove it, fix only the small heap it came from. This layering is the bootstrapping trick: a heap is built from a heap.",
        invariants: [
            "Every subheap is a valid binary min heap and the boot heap holds exactly one entry per nonempty subheap.",
            "The boot heap minimum equals the minimum over all stored elements.",
            "Delete-min touches only the subheap that supplied the minimum.",
        ],
        correctness:
            "Because each boot entry stores the true minimum of its subheap, the minimum of the boot heap is the minimum of the union of all subheaps, which proves find-min. Delete-min removes that minimum from its subheap; if elements remain, the recomputed minimum is a correct replacement entry, so the boot heap again describes every nonempty subheap. By induction over extractions, each delete-min returns the next smallest element, so the extracted sequence is sorted.",
        complexityRationale:
            "Insert and delete-min push or pop in two binary heaps of size at most n, costing O(log n) each; find-min reads the boot root in O(1), and meld just merges entry lists in O(log n). Storage is one element per value plus one boot entry per subheap, so O(n) space.",
        uses: [
            "Priority queues that need cheap meld operations",
            "Functional heap implementations built from a primitive heap",
            "Event schedulers that merge many independent queues",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures (1998), Chapter 9",
            "Fredman and Tarjan, Fibonacci Heaps and Their Uses (1987)",
        ],
        workedExample:
            "Inserting 5, 2, and 8 creates three subheaps and boot entries 5, 2, 8. Find-min returns 2. Delete-min empties the subheap holding 2 and leaves boot entries 5 and 8. Repeating yields 5, then 8, so the extracted order is 2, 5, 8.",
    },
    id: "bootstrapped-heap",
    name: "Bootstrapped Heap",
    category: "data-structures",
    complexity: { time: "O(log n) insert and deleteMin", space: "O(n)" },
    defaultInput: { values: [5, 2, 8, 1, 9, 3, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty boot heap and no subheaps",
        "for each value create a one-element min subheap",
        "insert that subheap minimum into the boot heap",
        "find-min reads the boot heap root",
        "delete-min pops the boot root and removes it from its subheap",
        "if that subheap survives reinsert its new minimum",
        "repeat delete-min until the boot heap is empty",
        "report the extracted sorted sequence",
    ],
};

export default module;
