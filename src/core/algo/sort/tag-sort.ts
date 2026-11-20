/**
 * tag-sort.ts - Tag sort: compute a rank for every element, then scatter.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tag sorting separates ranking from reordering. In a first pass each element
 * receives a tag equal to the number of values smaller than it, with ties
 * broken by original position; the tags are therefore unique destination
 * indices. A second pass writes every element into the slot named by its tag,
 * which yields sorted order and keeps equal keys in their original order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for tag computation, O(n) for scatter
 *   Space: O(n) for the tag list and output array
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first phase highlights the element whose tag is being counted.
 *   - The second phase fills destination slots left to right as GREEN.
 *   - The final frame shows the fully scattered sorted array.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    if (values.length === 0) {
        return [
            {
                id: "bar-empty",
                type: "bar" as const,
                label: "0",
                value: 0,
                state: "idle" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: 0 },
            },
        ];
    }
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function makeSlots(
    work: number[],
    filled: boolean[],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return work.map((value, index) => ({
        id: `slot-${index}`,
        type: "bar" as const,
        label: filled[index] ? String(value) : "_",
        value: filled[index] ? value : 0,
        state: states.get(index) ?? (filled[index] ? "sorted" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

type Extra = Record<string, number | string | boolean | number[] | string[]>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const src = Array.isArray(task.array) ? [...(task.array as number[])] : [5, 2, 9, 1, 5, 6];
    const n = src.length;
    let step = 0;
    let comparisons = 0;

    const emit = (
        desc: string,
        line: number,
        entities: VisualEntity[],
        extra: Extra = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description: desc,
        codeLineNumber: Math.min(line, 8),
        layout: "array",
        meta: { comparisons, n, ...extra },
    });

    yield emit("Tag sort first computes each element's rank, then scatters it into place.", 0, makeBars(src), {
        tags: [],
    });
    step += 1;
    if (n === 0) {
        yield emit("Empty array needs no tags and no placement.", 8, makeBars(src), {
            tags: [],
            work: [],
            sorted: [],
        });
        return;
    }

    const tags: number[] = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const vi = src[i] as number;
        for (let j = 0; j < n; j += 1) {
            comparisons += 1;
            const vj = src[j] as number;
            if (vj < vi || (vj === vi && j < i)) tags[i] = (tags[i] as number) + 1;
        }
        yield emit(
            `Value ${vi} at index ${i} gets tag ${tags[i]}: the count of smaller or earlier-equal values.`,
            2,
            makeBars(src, new Map([[i, "comparing"]])),
            { tags: [...tags], current: i },
        );
        step += 1;
    }

    yield emit(`All tags computed: [${tags.join(", ")}]; each is a unique destination index.`, 3, makeBars(src), {
        tags: [...tags],
    });
    step += 1;

    const work: number[] = new Array<number>(n).fill(0);
    const filled: boolean[] = new Array<boolean>(n).fill(false);
    for (let i = 0; i < n; i += 1) {
        const dest = tags[i] as number;
        work[dest] = src[i] as number;
        filled[dest] = true;
        yield emit(
            `Scatter value ${src[i]} into destination slot ${dest}.`,
            5,
            makeSlots(work, filled, new Map([[dest, "active"]])),
            { tags: [...tags], work: [...work], placed: i + 1 },
        );
        step += 1;
    }

    const allSorted = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) allSorted.set(i, "sorted");
    yield emit(`Sorted order: [${work.join(", ")}].`, 8, makeSlots(work, filled, allSorted), {
        tags: [...tags],
        work: [...work],
        sorted: [...work],
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Tag sorting splits sorting into two simpler jobs. First give every element a tag that says how many other elements should come before it, breaking ties by original position so every tag is unique. Then use each tag directly as an array index and write the element into that slot. Because the tags are the ranks, the destination array comes out sorted and stable.",
        invariants: [
            "For each index i, tag i equals the count of smaller values plus earlier equal values.",
            "The n tags are a permutation of 0 through n-1, so every destination is filled exactly once.",
            "After a scatter step, every filled slot already holds its final sorted value.",
        ],
        correctness:
            "An element's tag counts exactly how many elements precede it in sorted order, including earlier duplicates for stability, so each tag is the element's final position. Writing each value to its tag slot therefore places every value at its correct rank. Since the tags are distinct and cover all slots from 0 to n-1, no slot is overwritten or left empty, and the output is the sorted, stable sequence.",
        complexityRationale:
            "Computing a tag compares an element with all n elements, so the first phase costs O(n^2). The scatter phase is a single O(n) pass, and the tag list plus output array use O(n) space. The method needs no assumptions about the key range, unlike counting-based sorts.",
        uses: [
            "Teaching the separation of ranking from rearranging",
            "Sorting records when the rank function is supplied externally",
            "Stable sorting where keys are expensive but comparisons are cheap",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Sorting by Distribution",
            "NIST Dictionary of Algorithms and Data Structures, tag sort entry",
        ],
        workedExample:
            "For [5,2,9,1,5], the tags are [3,1,4,0,2]: 1 is smallest, 2 is next, the first 5 follows 1, the second 5 follows the first 5, and 9 is last. Scattering writes 1,2,5,5,9 into slots 0 through 4, giving the sorted array.",
    },
    id: "tag-sort",
    name: "Tag Sort",
    category: "sorting",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { array: [5, 2, 9, 1, 5, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "read the input array of n values",
        "initialize an empty list of tags",
        "for each index i count smaller values and earlier equal values",
        "store that count as tag i, the destination of element i",
        "create an empty output array of n slots",
        "for each i write element i into output slot tag i",
        "advance to the next element until all are placed",
        "the output array now holds the values in sorted order",
        "done: report the sorted output and the tag mapping",
    ],
};

export default module;
