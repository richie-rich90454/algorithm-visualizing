/**
 * kirkpatrick-reisch-sort.ts - Kirkpatrick-Reisch Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kirkpatrick-Reisch sort is a linear-time integer sort for bounded-width
 * keys. It splits every key into a high half and a low half, which form a
 * depth-two trie. The smallest leaf of each subtree is pinned as its first
 * child, and the remaining half-width keys are sorted recursively. Walking
 * the reordered trie emits the keys in ascending order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + n log(w / log n)) for w-bit keys; O(n) for fixed width
 *   Space: O(n) for the trie nodes and the recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The original bars are shown before the split.
 *   - Bars whose value is a subtree minimum are green (sorted).
 *   - Bars queued for the recursive half-width sort are yellow (highlight).
 *   - The final frame shows the fully sorted bars in green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SortTask {
    values?: number[];
}

interface Node {
    key: number;
    kind: "high" | "leaf";
    group: number;
}

interface Group {
    high: number;
    minLow: number;
    lows: number[];
    others: number[];
}

interface Trace {
    pairs: Array<[number, number]>;
    groups: Group[];
    nodeKeys: number[];
    sortedKeys: number[];
}

function countingSort(nodes: Node[]): Node[] {
    const buckets: Node[][] = Array.from({ length: 10 }, () => []);
    for (const node of nodes) {
        const key = Math.max(0, Math.min(9, node.key));
        (buckets[key] as Node[]).push(node);
    }
    return buckets.flat();
}

function sortNodes(nodes: Node[], digits: number): Node[] {
    if (nodes.length <= 1 || digits <= 1) {
        return countingSort(nodes);
    }
    const lowDigits = Math.floor(digits / 2);
    const highDigits = digits - lowDigits;
    const baseLow = 10 ** lowDigits;

    const groupMap = new Map<number, number[]>();
    for (const node of nodes) {
        const high = Math.floor(node.key / baseLow);
        if (!groupMap.has(high)) groupMap.set(high, []);
        (groupMap.get(high) as number[]).push(node.key % baseLow);
    }

    const next: Node[] = [];
    for (const [high, lows] of groupMap) {
        let minIndex = 0;
        for (let i = 1; i < lows.length; i += 1) {
            if ((lows[i] as number) < (lows[minIndex] as number)) minIndex = i;
        }
        next.push({ key: high, kind: "high", group: high });
        for (let i = 0; i < lows.length; i += 1) {
            if (i === minIndex) continue;
            next.push({ key: lows[i] as number, kind: "leaf", group: high });
        }
    }
    return sortNodes(next, highDigits);
}

function runCore(values: number[], digits: number): { sorted: number[]; trace: Trace } {
    const lowDigits = Math.floor(digits / 2);
    const highDigits = digits - lowDigits;
    const baseLow = 10 ** lowDigits;
    const pairs: Array<[number, number]> = values.map((value) => [
        Math.floor(value / baseLow),
        value % baseLow,
    ]);

    const groupMap = new Map<number, number[]>();
    for (const [high, low] of pairs) {
        if (!groupMap.has(high)) groupMap.set(high, []);
        (groupMap.get(high) as number[]).push(low);
    }
    const groups: Group[] = [];
    for (const [high, lows] of groupMap) {
        let minIndex = 0;
        for (let i = 1; i < lows.length; i += 1) {
            if ((lows[i] as number) < (lows[minIndex] as number)) minIndex = i;
        }
        groups.push({
            high,
            minLow: lows[minIndex] as number,
            lows: [...lows],
            others: lows.filter((_, i) => i !== minIndex),
        });
    }

    const nodes: Node[] = [];
    for (const group of groups) {
        nodes.push({ key: group.high, kind: "high", group: group.high });
        for (const low of group.others) {
            nodes.push({ key: low, kind: "leaf", group: group.high });
        }
    }
    const sortedNodes = sortNodes(nodes, highDigits);

    const sorted: number[] = [];
    for (const node of sortedNodes) {
        if (node.kind !== "high") continue;
        const group = groups.find((g) => g.high === node.key);
        if (!group) continue;
        sorted.push(node.key * baseLow + group.minLow);
        for (const leaf of sortedNodes) {
            if (leaf.kind === "leaf" && leaf.group === node.key) {
                sorted.push(node.key * baseLow + leaf.key);
            }
        }
    }

    return {
        sorted,
        trace: {
            pairs,
            groups,
            nodeKeys: nodes.map((node) => node.key),
            sortedKeys: sortedNodes.map((node) => node.key),
        },
    };
}

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (Array.isArray(input) ? { values: input as number[] } : (input as SortTask | null)) ?? {};
    const src = Array.isArray(task.values) ? (task.values as number[]) : [87, 12, 55, 54, 12, 33, 98, 44];
    const values = src.map((value) => Math.max(0, Math.floor(value)));
    const digits = 2;

    let step = 0;
    const emit = (
        shown: number[],
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(shown, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { size: values.length, ...meta },
    });

    yield emit(values, new Map(), `Kirkpatrick-Reisch sort of ${values.length} two-digit keys.`, 0);
    step += 1;

    const { sorted, trace } = runCore(values, digits);
    const highKeys = trace.pairs.map(([high]) => high);
    const lowKeys = trace.pairs.map(([, low]) => low);

    yield emit(
        values,
        new Map(values.map((_, index) => [index, "comparing" as EntityState])),
        `Split each key into high digit ${JSON.stringify(highKeys)} and low digit ${JSON.stringify(lowKeys)}.`,
        1,
        { highKeys, lowKeys },
    );
    step += 1;

    const minStates = new Map<number, EntityState>();
    values.forEach((value, index) => {
        if (trace.groups.some((group) => group.high === Math.floor(value / 10) && group.minLow === value % 10)) {
            minStates.set(index, "sorted");
        }
    });
    yield emit(
        values,
        minStates,
        `Pin the smallest low digit of each subtree as its first child (${trace.groups.length} subtree(s)).`,
        2,
        { subtrees: trace.groups.length },
    );
    step += 1;

    yield emit(
        values,
        new Map(values.map((_, index) => [index, "highlight" as EntityState])),
        `Recursively sort ${trace.nodeKeys.length} half-width keys: ${JSON.stringify(trace.nodeKeys)}.`,
        3,
        { keys: trace.nodeKeys.length, sortedKeys: trace.sortedKeys },
    );
    step += 1;

    yield emit(
        values,
        new Map(values.map((_, index) => [index, "visited" as EntityState])),
        `Ordered keys ${JSON.stringify(trace.sortedKeys)}; reattach each subtree by that order.`,
        4,
        { sortedKeys: trace.sortedKeys },
    );
    step += 1;

    yield emit(
        sorted,
        new Map(sorted.map((_, index) => [index, "sorted" as EntityState])),
        `Trie walk produced ${sorted.length} keys in ascending order.`,
        6,
        { comparisons: 0, output: sorted },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split every integer into a high digit and a low digit, and imagine a trie whose first level is the high digit and whose leaves are the low digits. If the smallest leaf of each subtree is made its first child, sorting the remaining half-width keys recursively tells us the exact order in which to reattach the children. A left-to-right walk then yields the sorted numbers.",
        invariants: [
            "Each subtree's pinned minimum is the smallest key in that subtree.",
            "The recursive call sorts keys with half as many digits as the original.",
            "Reattaching children in the sorted key order never changes the set of keys.",
        ],
        correctness:
            "Within a subtree the pinned minimum is smallest, and the remaining leaves are placed in increasing low-digit order by the recursive sort. Subtrees themselves are visited in increasing high-digit order. Every key is therefore emitted in nondecreasing order, and no key is lost because each subtree contributes exactly its own leaves.",
        complexityRationale:
            "Steps 1, 2, 4 and 5 each touch every key once, and step 3 recurses on half as many bits. The recurrence T(n,w) = T(n, ceil(w/2)) + O(n) gives O(n log(w / log n)) time, which is O(n) for a fixed key width; all structures are linear in n.",
        uses: [
            "Sorting bounded-width integer keys faster than radix sort",
            "A teaching example of recursive word-RAM algorithms",
            "Integer sorting inside high-throughput radix pipelines",
        ],
        references: [
            "Kirkpatrick and Reisch, Upper Bounds for Sorting Integers on Random Access Machines, 1983",
            "Czajka, Faster than radix sort: Kirkpatrick-Reisch sorting, 2020",
        ],
        workedExample:
            "For [87,12,55,54,12,33,98,44], the high digits are 8,1,5,5,1,3,9,4. Subtree 5 pins low digit 4 before 5; subtree 1 pins 2 before 2. The recursive sort orders the half-width keys, and the trie walk emits [12,12,33,44,54,55,87,98].",
    },
    id: "kirkpatrick-reisch-sort",
    name: "Kirkpatrick-Reisch Sort",
    category: "sorting",
    complexity: { time: "O(n log(w / log n))", space: "O(n)" },
    defaultInput: { values: [87, 12, 55, 54, 12, 33, 98, 44] },
    visualType: "array",
    run,
    pseudocode: [
        "split each key into a high half and a low half",
        "build a depth-two trie grouped by the high half",
        "pin the smallest leaf of each subtree as its first child",
        "collect the remaining half-width keys and sort them recursively",
        "reattach every child in the order given by the sorted keys",
        "walk the trie left to right, recombining high and low halves",
        "done: keys are in ascending order",
    ],
};

export default module;
