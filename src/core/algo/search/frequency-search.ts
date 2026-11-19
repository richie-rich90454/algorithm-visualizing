/**
 * frequency-search.ts - Frequency-Ordered Sequential Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Frequency search is a self-organizing linear search from Knuth's TAOCP.
 * When the access frequencies of the records are known, arranging them in
 * decreasing frequency puts the most requested records at the front, so a
 * sequential search finds common targets after very few comparisons. The
 * example counts how many comparisons the frequency order saves over the
 * original order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + u) to build the table and order, then O(j) for a hit at rank j
 *   Space: O(n) for the frequency table and the reordered list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars in the frequency table are yellow (highlight) with frequency as height.
 *   - Bars in the frequency order are pink (visited).
 *   - The bar being compared is orange (comparing).
 *   - A successful hit is green (sorted); a miss flashes red (error).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FrequencyTask {
    items?: number[];
    query?: number;
}

function makeBars(
    values: number[],
    heights: number[],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value: heights[index] ?? 1,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, frequency: heights[index] ?? 1 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FrequencyTask | null) ?? {};
    const items = Array.isArray(task.items) ? [...(task.items as number[])] : [5, 3, 5, 1, 2, 5, 4, 3, 5];
    const query = typeof task.query === "number" ? task.query : 4;
    const n = items.length;

    let step = 0;
    const emit = (
        values: number[],
        heights: number[],
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, heights, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { query, size: n, ...extra },
    });

    yield emit(items, items.map(() => 1), new Map(), `Frequency search for ${query} among ${n} items.`, 0, {
        comparisons: 0,
    });
    step += 1;

    if (n === 0) {
        yield emit([], [], new Map(), "The item list is empty, so the query cannot be found.", 6, {
            found: false,
            position: -1,
            comparisons: 0,
        });
        return;
    }

    const counts = new Map<number, number>();
    const firstSeen = new Map<number, number>();
    items.forEach((value, index) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        if (!firstSeen.has(value)) firstSeen.set(value, index);
    });

    const freqHeights = items.map((value) => counts.get(value) ?? 1);
    yield emit(
        items,
        freqHeights,
        new Map(items.map((_, index) => [index, "highlight" as EntityState])),
        `Built a frequency table with ${counts.size} distinct value(s).`,
        1,
        { distinct: counts.size },
    );
    step += 1;

    const ordered = [...items].sort((a, b) => {
        const diff = (counts.get(b) as number) - (counts.get(a) as number);
        return diff !== 0 ? diff : (firstSeen.get(a) as number) - (firstSeen.get(b) as number);
    });
    const orderedHeights = ordered.map((value) => counts.get(value) ?? 1);
    yield emit(
        ordered,
        orderedHeights,
        new Map(ordered.map((_, index) => [index, "visited" as EntityState])),
        `Reordered by decreasing frequency: ${JSON.stringify(ordered)}.`,
        2,
        { distinct: counts.size },
    );
    step += 1;

    let comparisons = 0;
    let position = -1;
    let naiveComparisons = 0;
    for (const value of items) {
        naiveComparisons += 1;
        if (value === query) break;
    }

    for (let i = 0; i < ordered.length; i += 1) {
        comparisons += 1;
        const states = new Map<number, EntityState>();
        for (let k = 0; k < i; k += 1) states.set(k, "visited");
        states.set(i, "comparing");
        yield emit(
            ordered,
            orderedHeights,
            states,
            `Compare position ${i}: ${ordered[i]} ${ordered[i] === query ? "matches" : "does not match"} ${query}.`,
            3,
            { comparisons, position: -1 },
        );
        step += 1;
        if (ordered[i] === query) {
            position = i;
            states.set(i, "sorted");
            yield emit(
                ordered,
                orderedHeights,
                states,
                `Found ${query} at frequency rank ${i} after ${comparisons} comparison(s).`,
                4,
                { comparisons, position, naiveComparisons, saved: naiveComparisons - comparisons },
            );
            step += 1;
            break;
        }
    }

    if (position === -1) {
        yield emit(
            ordered,
            orderedHeights,
            new Map(ordered.map((_, index) => [index, "error" as EntityState])),
            `${query} is absent; all ${n} positions were compared.`,
            5,
            { comparisons, position, found: false, naiveComparisons },
        );
        return;
    }

    yield emit(
        ordered,
        orderedHeights,
        new Map(ordered.map((_, index) => [index, "sorted" as EntityState])),
        `Frequency order used ${comparisons} comparison(s) versus ${naiveComparisons} in original order.`,
        6,
        { found: true, position, comparisons, naiveComparisons, saved: naiveComparisons - comparisons },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If some records are requested far more often than others, a plain linear search wastes time scanning unpopular items first. Frequency-ordered search counts how often each value occurs, sorts the list from most to least frequent, and then searches that list linearly. Common values are found near the front with very few comparisons.",
        invariants: [
            "The frequency table records the exact number of occurrences of every distinct value.",
            "The reordered list is a permutation of the original items.",
            "Values with equal frequency keep their original first-occurrence order.",
        ],
        correctness:
            "Sorting by frequency only permutes the list, so every value present originally is still present. A linear scan over any permutation finds a target exactly when the target is in the list, and the reported rank is the first position of that target in the frequency order.",
        complexityRationale:
            "Counting and first-occurrence tracking take O(n) time and O(u) space for u distinct values; sorting the distinct values costs O(u log u). A search takes O(j) comparisons where j is the target's frequency rank, at most n.",
        uses: [
            "Self-organizing lists with known access probabilities",
            "Placing hot keys near the front of a small unsorted table",
            "A teaching example of probability-aware search",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.1 (Sequential Searching)",
            "Sedgewick and Wayne, Algorithms, Section 3.1 (Searching)",
        ],
        workedExample:
            "For [5,3,5,1,2,5,4,3,5] the frequencies are 5:4, 3:2 and 1,2,4:1. The frequency order is [5,5,5,5,3,3,1,2,4]. Searching for 4 now takes seven comparisons in the reordered list but eight in the original list.",
    },
    id: "frequency-search",
    name: "Frequency-Ordered Search",
    category: "searching",
    complexity: { time: "O(n + u log u + j)", space: "O(n)" },
    defaultInput: { items: [5, 3, 5, 1, 2, 5, 4, 3, 5], query: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "count the occurrences of every distinct value",
        "record where each value first appeared",
        "sort values by decreasing count, breaking ties by first appearance",
        "scan the frequency-ordered list from the front",
        "stop when the query matches or the list is exhausted",
        "report the found rank and the comparisons saved",
        "done: return the search result",
    ],
};

export default module;
