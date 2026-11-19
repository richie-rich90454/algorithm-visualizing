/**
 * finger-search-tree.ts - Finger Search Tree
 *
 * A finger search exploits locality: if the next query is near the previous
 * one, searching from a pointer (the finger) into a balanced ordered sequence
 * is faster than restarting at the root. This demo keeps the keys in sorted
 * order and searches by galloping outward from the finger in doubling steps
 * until the query is bracketed, then finishes with a binary search in the
 * bracket. The number of probes depends on the distance from the finger, not
 * on the total number of keys.
 *
 * Time:  O(log d) probes where d is the finger distance, O(log n) worst case
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Result {
    found: number;
    pos: number;
    probes: number[];
    finalFinger: number;
}

function fingerSearch(arr: number[], finger: number, query: number): Result {
    const n = arr.length;
    let f = finger >= 0 && finger < n ? finger : 0;
    const probes: number[] = [f];
    if ((arr[f] ?? 0) === query) return { found: 1, pos: f, probes, finalFinger: f };

    let lo: number;
    let hi: number;
    if ((arr[f] ?? 0) < query) {
        let bound = f;
        let step = 1;
        while (bound < n - 1 && (arr[bound] ?? 0) < query) {
            bound = Math.min(n - 1, bound + step);
            probes.push(bound);
            step *= 2;
        }
        lo = f + 1;
        hi = bound;
    } else {
        let bound = f;
        let step = 1;
        while (bound > 0 && (arr[bound] ?? 0) > query) {
            bound = Math.max(0, bound - step);
            probes.push(bound);
            step *= 2;
        }
        lo = bound;
        hi = f - 1;
    }

    let pos = -1;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        probes.push(mid);
        const value = arr[mid] ?? 0;
        if (value === query) {
            pos = mid;
            break;
        }
        if (value < query) lo = mid + 1;
        else hi = mid - 1;
    }
    return {
        found: pos >= 0 ? 1 : 0,
        pos,
        probes,
        finalFinger: pos >= 0 ? pos : probes[probes.length - 1] ?? f,
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queries?: number[] } | null) ?? {};
    const keys = Array.from(
        new Set(Array.isArray(task.keys) && task.keys.length > 0 ? task.keys : [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]),
    ).sort((a, b) => a - b);
    const queries = Array.isArray(task.queries) ? task.queries : [15, 17, 16, 3, 31];
    let finger = Math.floor(keys.length / 2);
    let step = 0;
    const hits: number[] = [];
    const positions: number[] = [];

    const cells = (hot: number): VisualEntity[] =>
        keys.map((value, index) => ({
            id: `fs-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === hot ? "comparing" : index === finger ? "pivot" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, index, finger: index === finger ? 1 : 0 },
        }));

    yield {
        stepNumber: step,
        entities: cells(-1),
        edges: [],
        description: `Sorted keys in order; the finger starts at index ${finger} (key ${keys[finger] ?? 0}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys: [...keys], finger, hits: [], positions: [] },
    };
    step += 1;

    for (const query of queries) {
        const result = fingerSearch(keys, finger, query);
        hits.push(result.found);
        positions.push(result.pos);
        for (const index of result.probes) {
            yield {
                stepNumber: step,
                entities: cells(index),
                edges: [],
                description: `Query ${query}: probe index ${index} holding ${keys[index] ?? 0} while galloping from the finger.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { keys: [...keys], finger, query, probe: index, probes: result.probes.length, hits: [...hits], positions: [...positions] },
            };
            step += 1;
        }
        finger = result.finalFinger;
        yield {
            stepNumber: step,
            entities: cells(result.found ? result.pos : -1),
            edges: [],
            description:
                result.found === 1
                    ? `Query ${query}: hit at index ${result.pos} after ${result.probes.length} probe(s); finger moves there.`
                    : `Query ${query}: miss after ${result.probes.length} probe(s); finger moves to the nearest key.`,
            codeLineNumber: 7,
            layout: "grid",
            meta: { keys: [...keys], finger, query, found: result.found, pos: result.pos, hits: [...hits], positions: [...positions] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(-1).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `All queries answered; the final finger sits at index ${finger}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: { keys: [...keys], hits, positions, finger },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A finger search tree keeps a pointer called a finger near the last item you touched. When the next query is close by, you do not start over at the root. You gallop outward from the finger, doubling the stride each time until you pass the target, then binary search the small bracket you landed in. Work depends on how far the query is from the finger rather than on the size of the whole collection.",
        invariants: [
            "The keys stay in sorted order and the finger always points at a valid key.",
            "Galloping expands a bracket that contains the query whenever the query is present.",
            "After each search the finger moves to the result or to the closest probed key, preserving locality.",
        ],
        correctness:
            "If the query is present, the gallop stops with one endpoint below and one endpoint above it because the stride eventually reaches the whole array and comparisons are monotone in sorted order. The following binary search over that bracket finds the exact slot, so a hit is returned exactly when the key exists, matching a brute-force search. Moving the finger to a probed valid index keeps it inside the array for the next query.",
        complexityRationale:
            "Galloping takes O(log d) doublings to cover a finger distance d, and the final binary search covers a bracket of size at most O(d), also O(log d) probes. Worst case d is n, giving O(log n). The sorted array uses O(n) space and the finger is one integer.",
        uses: [
            "Ordered indexes with sequential or clustered access patterns",
            "Text editors tracking cursor-relative positions in a document",
            "Database cursors that repeatedly fetch nearby keys",
        ],
        references: [
            "Guibas and Stolfi, A Class of Implicit Balanced Search Trees with O(log d) Finger Search, 1984",
            "Sleator and Tarjan, Self-Adjusting Binary Search Trees, 1985",
        ],
        workedExample:
            "With keys 1 through 31 odd numbers and a finger at index 8 (key 17), searching 15 probes the finger, gallops left to index 4 (key 9), then binary searches indices 5 through 7 to find 15 at index 7. The finger moves to 7. The next query 17 starts there, probes index 7, and finds 17 at index 8 in just two steps.",
    },
    id: "finger-search-tree",
    name: "Finger Search Tree",
    category: "data-structures",
    complexity: { time: "O(log d) probes", space: "O(n)" },
    defaultInput: {
        keys: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
        queries: [15, 17, 16, 3, 31],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the keys and start the finger at the middle",
        "for each query compare it with the key at the finger",
        "if they match report the finger index immediately",
        "gallop outward doubling the step until the key is bracketed",
        "narrow the bracket with a standard binary search",
        "if the final slot holds the key report a hit",
        "otherwise report a miss for that query",
        "move the finger to the last valid examined index",
        "report all hits and their positions",
    ],
};

export default module;
