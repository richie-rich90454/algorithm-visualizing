/**
 * transpose-sequential-search.ts - Transpose Sequential Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Another self-organizing list heuristic. On a successful search it swaps the
 * found item with its immediate predecessor, nudging popular items one step
 * toward the front at a time. Compared with move-to-front it reacts more
 * gently: a one-off deep hit does not leapfrog frequent short-list items.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) per query   Space: O(1) beyond the list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current list; the probe is yellow and the match green.
 *   - The single swap after a hit highlights the two exchanged bars red.
 *   - A miss leaves the list unchanged.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    list: number[],
    states: Map<number, EntityState> = new Map(),
    query: number = -1,
): VisualEntity[] {
    return list.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}${value === query ? " *" : ""}`,
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, key: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { items?: number[]; queries?: number[] } | null) ?? {};
    const list = Array.isArray(task.items) ? [...task.items] : [5, 3, 8, 1, 9];
    const queries = Array.isArray(task.queries) ? [...task.queries] : [8, 8, 1, 5, 2];
    let step = 0;
    let comparisons = 0;
    let transposes = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState>,
        queryIndex: number,
        query: number,
        found: boolean,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(list, states, query),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { queryIndex, query, found, comparisons, transposes, length: list.length },
    });

    yield snap("Initial list with a sequence of queries to serve.", 0, new Map(), -1, -1, false);
    step += 1;

    for (let q = 0; q < queries.length; q += 1) {
        const query = queries[q] as number;
        let foundAt = -1;
        for (let i = 0; i < list.length; i += 1) {
            comparisons += 1;
            const isMatch = (list[i] as number) === query;
            yield snap(
                `Query ${query}: comparing position ${i} (value ${list[i]})${isMatch ? " - match" : ""}.`,
                2,
                new Map([[i, isMatch ? "sorted" : "comparing"]]),
                q,
                query,
                isMatch,
            );
            step += 1;
            if (isMatch) {
                foundAt = i;
                break;
            }
        }

        if (foundAt < 0) {
            yield snap(`Query ${query}: not in the list; order is unchanged.`, 5, new Map(), q, query, false);
            step += 1;
            continue;
        }

        if (foundAt > 0) {
            const a = list[foundAt - 1] as number;
            const b = list[foundAt] as number;
            list[foundAt - 1] = b;
            list[foundAt] = a;
            transposes += 1;
            yield snap(
                `Query ${query}: transposing ${b} with its predecessor ${a}.`,
                4,
                new Map([[foundAt - 1, "swapped"], [foundAt, "active"]]),
                q,
                query,
                true,
            );
            step += 1;
        }
        yield snap(`Query ${query}: found at position ${foundAt > 0 ? foundAt - 1 : 0}.`, 5, new Map([[foundAt > 0 ? foundAt - 1 : 0, "sorted"]]), q, query, true);
        step += 1;
    }

    yield snap(`Served ${queries.length} queries with ${transposes} transposition(s).`, 6, new Map(), queries.length, -1, false);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Self-organizing lists reuse the results of past searches. The transpose rule is deliberately conservative: after finding a key it swaps that key with the one just ahead of it, so an item creeps toward the front only through repeated hits. This keeps a single lucky deep search from displacing items that are genuinely popular near the head.",
        invariants: [
            "A successful search stops at the first occurrence of the target.",
            "A transpose swaps the found item with exactly its immediate predecessor, if one exists.",
            "An unsuccessful query never changes the list.",
        ],
        correctness:
            "The scan tests positions from the front and stops at the first match, so found is true exactly when the query occurs. Swapping adjacent entries at positions i-1 and i is the defined transpose move and keeps every element present exactly once; when i is zero there is no predecessor and the list is unchanged. misses perform no swap. Hence the reported verdicts and the evolving list agree with the specification.",
        complexityRationale:
            "A query scans at most the full list of length m, and the adjacent swap is constant time, so each query is O(m). Apart from the list itself only counters and indices are kept, so auxiliary space is O(1).",
        uses: [
            "Adaptive ordering of small symbol or command lists",
            "List-update models in online algorithm theory",
            "Comparing gentle versus aggressive promotion heuristics",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 3, Section 6.1",
            "Rivest and Chien, On the Complexity of the Self-Organizing Sequential Search Heuristics, 1975",
        ],
        workedExample:
            "From [5, 3, 8, 1, 9], searching for 8 compares 5, 3, 8 and then swaps 8 with 3: [5, 8, 3, 1, 9]. Searching for 8 again finds it at position 1 and swaps it with 5, giving [8, 5, 3, 1, 9]. Two hits have carried 8 to the front one step at a time.",
    },
    id: "transpose-sequential-search",
    name: "Transpose Sequential Search",
    category: "searching",
    complexity: { time: "O(m) per query", space: "O(1)" },
    defaultInput: { items: [5, 3, 8, 1, 9], queries: [8, 8, 1, 5, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "start with the given list and query stream",
        "for each query in the stream",
        "scan from the front until the value matches",
        "if no match, leave the list unchanged",
        "on a match at position i greater than zero",
        "swap the match with the item at position i minus one",
        "record a hit and continue",
        "done: report final list and transposition count",
    ],
};

export default module;
