/**
 * sentinel-linear-search.ts – Sentinel Linear Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sentinel linear search is a classic optimization of plain linear search. It
 * writes the target value just past the end of the array, then scans from the
 * left without ever checking the loop bound. Because the sentinel guarantees
 * a match, the scan always stops, and a final index test says whether the
 * match was a real element or only the sentinel. This halves the comparisons
 * in the inner loop compared with a bounds-checked scan.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) worst and average, O(1) best
 *   Space: O(1) auxiliary apart from the sentinel slot
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The element being compared is YELLOW.
 *   - The appended sentinel is PINK.
 *   - A real match is GREEN; a sentinel-only match is RED.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Works on unsorted data.
 *   - The scan never needs an explicit index bound test.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    arr: number[],
    states: Map<number, EntityState> = new Map(),
    sentinelIndex: number = -1,
): VisualEntity[] {
    return arr.map((value, index) => {
        const state: EntityState = index === sentinelIndex ? "highlight" : (states.get(index) ?? "idle");
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: index === sentinelIndex ? `${value}*` : String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, sentinel: index === sentinelIndex },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [5, 3, 8, 1, 9, 2, 7, 4];
    const target = typeof task.target === "number" ? task.target : 7;
    const withSentinel = [...arr, target];
    const sentinelIndex = arr.length;

    let step = 0;
    let comparisons = 0;
    const frame = (
        description: string,
        states: Map<number, EntityState>,
        codeLineNumber: number,
        foundIndex: number = -2,
        showSentinel: boolean = false,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(showSentinel ? withSentinel : arr, states, showSentinel ? sentinelIndex : -1),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, target, foundIndex },
    });

    yield frame(`Searching for ${target} with a sentinel at the end.`, new Map(), 0);
    yield frame(
        `Wrote the sentinel ${target} at index ${sentinelIndex}; the scan no longer needs a bounds check.`,
        new Map(),
        1,
        -2,
        true,
    );

    let i = 0;
    for (;;) {
        comparisons += 1;
        const value = withSentinel[i] as number;
        yield frame(
            `Compare index ${i}: ${value} against target ${target}.`,
            new Map<number, EntityState>([[i, "comparing"]]),
            2,
            -2,
            true,
        );
        if (value === target) {
            break;
        }
        i += 1;
    }

    const foundIndex = i < arr.length ? i : -1;
    if (foundIndex >= 0) {
        yield frame(
            `Found ${target} at index ${foundIndex} after ${comparisons} comparisons.`,
            new Map<number, EntityState>([[foundIndex, "sorted"]]),
            3,
            foundIndex,
            true,
        );
    } else {
        yield frame(
            `Only the sentinel matched; ${target} is absent after ${comparisons} comparisons.`,
            new Map<number, EntityState>([[sentinelIndex, "error"]]),
            4,
            -1,
            true,
        );
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain linear search checks two things each step: whether the index is still in range and whether the value matches. The sentinel trick removes the first check. Put the target value one slot past the end, then walk forward comparing values until a match is guaranteed. If the match happens at the real end slot, the target was not present.",
        invariants: [
            "The value at the extra slot always equals the target, so the scan cannot run off the end.",
            "Every real index before the current one has been compared and does not match.",
            "A match before the extra slot means the target occurs at that index.",
        ],
        correctness:
            "The scan visits indices in increasing order and stops at the first match. If a real element equals the target, it is eventually reached and reported. If no real element matches, the scan reaches the sentinel at index n, which equals the target by construction, so it stops and reports absence. Either way the reported index matches a direct search of the original array.",
        complexityRationale:
            "The inner loop performs one comparison per visited element and visits at most n plus one slots, so time is O(n) with a smaller constant than a bounds-checked scan. Only the sentinel slot is extra, giving O(1) auxiliary space.",
        uses: [
            "Hand-optimized scans over raw arrays and strings",
            "Searching fixed-size buffers where one spare slot exists",
            "Teaching how loop invariants can remove branch overhead",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.1",
            "Bentley, Writing Efficient Programs, 1982",
        ],
        workedExample:
            "To find 7 in [5, 3, 8], append a sentinel to get [5, 3, 8, 7]. Compare 5, 3, then 8, then the sentinel 7 at index 3. Since the match is at the sentinel slot, report that 7 is absent, exactly as a direct search would.",
    },
    id: "sentinel-linear-search",
    name: "Sentinel Linear Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [5, 3, 8, 1, 9, 2, 7, 4], target: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "start with the array and the target value",
        "write the target into one extra slot past the end",
        "set the scan index to zero",
        "while the current value differs from the target, advance",
        "if the stopping index is before the extra slot, report found",
        "otherwise report that the target is absent",
        "done: return the found index or not present",
    ],
};

export default module;
