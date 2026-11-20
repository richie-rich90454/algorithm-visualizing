/**
 * move-to-front-search.ts - Move-To-Front Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A self-organizing list reorders itself as it is searched. Move-to-front
 * search scans from the head; when it finds the target it promotes that item
 * to the very front. Frequently requested items drift toward the head, so
 * later searches for popular keys get faster without any global knowledge.
 * This is a search heuristic, distinct from the move-to-front compression
 * transform used after a Burrows-Wheeler transform.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(list length) per query   Space: O(1) beyond the list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current list order; the probe is yellow.
 *   - A match is green and slides toward the front in red steps.
 *   - A miss leaves the list unchanged and is shown gray.
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
    const list = Array.isArray(task.items) ? [...task.items] : [3, 1, 4, 1, 5];
    const queries = Array.isArray(task.queries) ? [...task.queries] : [4, 1, 5, 2];
    let step = 0;
    let comparisons = 0;
    let hits = 0;

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
        meta: { queryIndex, query, found, comparisons, hits, length: list.length },
    });

    yield snap("Initial list with a sequence of queries to serve.", 0, new Map(), -1, -1, false);
    step += 1;

    for (let q = 0; q < queries.length; q += 1) {
        const query = queries[q] as number;
        let foundAt = -1;
        for (let i = 0; i < list.length; i += 1) {
            comparisons += 1;
            const isMatch = (list[i] as number) === query;
            const states = new Map<number, EntityState>([[i, isMatch ? "sorted" : "comparing"]]);
            yield snap(
                `Query ${query}: comparing position ${i} (value ${list[i]})${isMatch ? " - match" : ""}.`,
                2,
                states,
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

        hits += 1;
        if (foundAt > 0) {
            const item = list.splice(foundAt, 1)[0] as number;
            list.unshift(item);
            yield snap(
                `Query ${query}: moving the match from position ${foundAt} to the front.`,
                4,
                new Map([[0, "swapped"], [foundAt, "active"]]),
                q,
                query,
                true,
            );
            step += 1;
        }
        yield snap(`Query ${query}: found at the front after promotion.`, 5, new Map([[0, "sorted"]]), q, query, true);
        step += 1;
    }

    yield snap(`Served ${queries.length} queries, ${hits} hit(s), ${comparisons} comparison(s).`, 6, new Map(), queries.length, -1, false);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain list search always starts at the front, so a popular item buried deep costs the same as an unpopular one every time. Move-to-front search bets that a recently found item will be wanted again: after each successful search it slides that item all the way to the head. Over a stream of queries the popular keys cluster near the front and the average scan shortens, with no need to count or predict anything.",
        invariants: [
            "A successful search always finds the first occurrence of the target.",
            "After a hit, the found item is at index 0 and all other items keep their relative order.",
            "A miss leaves the list exactly as it was.",
        ],
        correctness:
            "The scan examines positions from 0 upward and stops at the first index whose value equals the query, so a hit is reported exactly when the value occurs and a miss exactly when it does not. Splicing the found item out and prepending it preserves the relative order of the remaining items and places the match at the front; an unsuccessful search performs no splice. Therefore the reported verdicts and the final list match the stated semantics.",
        complexityRationale:
            "Each query scans until the first match or the end of the list, at most O(m) comparisons for a list of length m; a promotion is O(m) array operations. The list itself is the only stored structure, so auxiliary space is O(1).",
        uses: [
            "Self-organizing caches and recency lists",
            "Symbol tables where recently used symbols dominate",
            "A baseline heuristic for dynamic list access studies",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 3, Section 6.1",
            "Sleator and Tarjan, Amortized Efficiency of List Update, 1985",
        ],
        workedExample:
            "Start with [3, 1, 4, 1, 5]. Searching for 4 compares 3, 1, then 4 and moves 4 to the front: [4, 3, 1, 1, 5]. Searching for 5 next finds it at the tail after four comparisons and promotes it: [5, 4, 3, 1, 1]. The popular items have drifted toward the head.",
    },
    id: "move-to-front-search",
    name: "Move-To-Front Search",
    category: "searching",
    complexity: { time: "O(m) per query", space: "O(1)" },
    defaultInput: { items: [3, 1, 4, 1, 5], queries: [4, 1, 5, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "start with the given list and query stream",
        "for each query in the stream",
        "scan the list from the front for the query value",
        "on a match, stop the scan",
        "if found and not already first, remove it and insert at the front",
        "on a miss, leave the list unchanged",
        "record the hit or miss",
        "done: report final list and hit count",
    ],
};

export default module;
