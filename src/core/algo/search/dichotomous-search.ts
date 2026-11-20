/**
 * dichotomous-search.ts - Dichotomous Search on a Sorted Array
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Binary search probes one middle element per step. Dichotomous search probes
 * two adjacent middle positions instead, then decides from both comparisons at
 * once. When the key lies strictly between the two probes the key cannot be in
 * the array, so the search stops immediately; otherwise it discards a segment
 * of the interval from at least one end.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) probes (two comparisons per probe position)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The live interval is tinted (highlight); the two probes are comparing.
 *   - A hit is green (sorted); discarded elements are idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type SearchInput = { array?: number[]; target?: number };

function makeBars(arr: number[], states: Map<number, EntityState>, lo: number, hi: number): VisualEntity[] {
    return arr.map((value, index) => {
        const inRange = index >= lo && index <= hi;
        const state = states.get(index) ?? (inRange ? "highlight" : "idle");
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

/** Execute one step of the two-probe search and report the outcome. */
function probeStep(arr: number[], target: number, lo: number, hi: number) {
    if (lo > hi) {
        return { kind: "empty" as const, p1: -1, p2: -1, nextLo: lo, nextHi: hi };
    }
    if (lo === hi) {
        return arr[lo] === target
            ? { kind: "found" as const, p1: lo, p2: lo, nextLo: lo, nextHi: hi }
            : { kind: "empty" as const, p1: lo, p2: lo, nextLo: lo, nextHi: hi };
    }
    const p1 = Math.floor((lo + hi) / 2);
    const p2 = p1 + 1;
    if (arr[p1] === target || arr[p2] === target) {
        return { kind: "found" as const, p1, p2, nextLo: lo, nextHi: hi };
    }
    if (target < (arr[p1] as number)) {
        return { kind: "left" as const, p1, p2, nextLo: lo, nextHi: p1 - 1 };
    }
    if (target > (arr[p2] as number)) {
        return { kind: "right" as const, p1, p2, nextLo: p2 + 1, nextHi: hi };
    }
    return { kind: "between" as const, p1, p2, nextLo: lo, nextHi: hi };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SearchInput | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [1, 3, 5, 7, 9, 11, 13, 15];
    const target = typeof task.target === "number" ? task.target : 9;

    let lo = 0;
    let hi = arr.length - 1;
    let step = 0;
    let found = -1;

    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map(), lo, hi),
        edges: [],
        description: `Dichotomous search for ${target} in ${arr.length} sorted elements; two middle probes per step.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lo, hi, target, found, probes: 0 },
    };
    step += 1;

    while (lo <= hi) {
        const result = probeStep(arr, target, lo, hi);
        const states = new Map<number, EntityState>();
        if (result.p1 >= 0) {
            states.set(result.p1, "comparing");
        }
        if (result.p2 >= 0 && result.p2 !== result.p1) {
            states.set(result.p2, "comparing");
        }
        if (result.kind === "found") {
            const hit = arr[result.p1] === target ? result.p1 : result.p2;
            found = hit;
            states.set(hit, "sorted");
        }

        yield {
            stepNumber: step,
            entities: makeBars(arr, states, lo, hi),
            edges: [],
            description:
                result.kind === "found"
                    ? `Probes ${result.p1} and ${result.p2}: found ${target} at index ${found}.`
                    : result.kind === "between"
                      ? `Key lies between probes ${result.p1} and ${result.p2}; the key cannot be present.`
                      : `Probes ${result.p1} and ${result.p2}: discard the ${result.kind} half, new interval ${result.nextLo} to ${result.nextHi}.`,
            codeLineNumber: result.kind === "found" ? 6 : result.kind === "between" ? 5 : 4,
            layout: "array",
            meta: { lo, hi, p1: result.p1, p2: result.p2, kind: result.kind, found, probes: step },
        };
        step += 1;

        if (result.kind === "found" || result.kind === "between" || result.kind === "empty") {
            break;
        }
        lo = result.nextLo;
        hi = result.nextHi;
    }

    const finalStates = new Map<number, EntityState>();
    if (found >= 0) {
        finalStates.set(found, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates, 0, arr.length - 1),
        edges: [],
        description: found >= 0 ? `Search succeeded at index ${found}.` : `Key ${target} is not in the array.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { found, present: found >= 0, probes: Math.max(0, step - 1), target },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Look at two neighboring positions in the middle of the sorted interval instead of one. If the key falls strictly between them, it cannot exist; otherwise both comparisons agree on which side to keep. The pair of probes removes a segment from at least one end every step.",
        invariants: [
            "If the key is present, its index always lies within the current interval.",
            "Both probe positions lie inside the current interval whenever it has two or more elements.",
            "The interval strictly shrinks on every continuing step.",
        ],
        correctness:
            "For a sorted array, if the key is smaller than the left probe it must be to the left, and if it is larger than the right probe it must be to the right. If it lies strictly between two adjacent probes, no array slot can hold it. These cases cover every possibility, so the reported index is correct whenever one exists.",
        complexityRationale:
            "Each continuing step removes at least one probe position from a side and halves the interval, giving at most O(log n) iterations with a constant number of comparisons and O(1) stored pointers.",
        uses: [
            "Lookup in sorted static tables when a predictable pair of branches is useful",
            "Teaching the idea of narrowing a search interval with multiple probes",
            "Searching sorted arrays on hardware where branch prediction favors fixed probe counts",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 6.1",
            "NIST Dictionary of Algorithms and Data Structures, dichotomous search",
        ],
        workedExample:
            "In [1, 3, 5, 7, 9, 11] searching for 9, the first probes are indices 2 and 3 with values 5 and 7. Since 9 is larger than 7, the interval becomes 4 to 5; the next probes are indices 4 and 5 and index 4 holds 9, so the search succeeds in two steps.",
    },
    id: "dichotomous-search",
    name: "Dichotomous Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [1, 3, 5, 7, 9, 11, 13, 15], target: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "set lo to 0 and hi to n minus 1",
        "while lo is at most hi",
        "choose two middle probes p and p plus one",
        "if either probe equals the key report that index",
        "if the key is smaller than the left probe set hi to p minus 1",
        "if the key is larger than the right probe set lo to p plus 2",
        "otherwise the key lies between probes and is absent",
        "report that the key was not found",
        "done: report the index or absence",
    ],
};

export default module;
