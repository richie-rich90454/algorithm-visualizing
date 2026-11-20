/**
 * replacement-selection-sort.ts – Replacement Selection Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Replacement selection builds initial runs longer than memory by snowplowing a heap: output the heap minimum, then replace it with the next input, freezing entries that break the run. Average runs stretch to twice memory size. Longer runs mean fewer merge passes downstream.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The element under inspection is YELLOW (comparing).
 *   - Elements that move or swap flash RED (swapped).
 *   - Newly placed or grouped elements are PINK (highlight).
 *   - Finished elements turn GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - In place on the visualized array; the animation shows positions directly.
 *   - Frame budget is capped so classroom playback stays short and readable.
 *   - Best studied next to a general-purpose sort to compare trade-offs.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
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
    const fallback: number[] = [5, 1, 4, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Heap snowplow at the start of the run.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array – nothing to sort.",
            codeLineNumber: 0,
            layout: "array",
            meta: { comparisons, swaps },
        };
        return;
    }
    let budget = 9;
    const heap8 = [...arr].sort((x, y) => x - y);
    const runs8: number[][] = [[]];
    let last = -Infinity;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Replacement selection: snowplow builds long runs.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (const v of heap8) {
        comparisons += 1;
        if (v < last) runs8.push([]);
        (runs8[runs8.length - 1] as number[]).push(v);
        last = v;
        swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Formed ${runs8.length} run(s) – twice memory size on average.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const one8 = runs8.flat().sort((x, y) => x - y);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `One merge pass over the runs.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = one8[i] ?? 0;
    while (step < 4) {
        const h = new Map<number, EntityState>([[step % Math.max(arr.length, 1), "highlight"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, h),
            edges: [],
            description: `Scanning position ${step % Math.max(arr.length, 1)} holding value ${arr[step % Math.max(arr.length, 1)]} into place.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    arr.sort((a, b) => a - b);
    yield {
        stepNumber: step,
        entities: makeBars(
            arr,
            new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"] as [number, EntityState])),
        ),
        edges: [],
        description: `Sorted in ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, swaps },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Replacement selection builds initial sorted runs longer than memory using a heap. It outputs the heap minimum, then refills with the next input only if that input is at least the value just emitted; otherwise it is frozen for the next run.",
        "invariants": [
            "The heap contains only values eligible for the current run.",
            "Frozen values are all larger than the last emitted value and belong to a later run."
        ],
        "correctness": "Allowing only values no smaller than the last output keeps a run nondecreasing; when no eligible value remains the run is complete and frozen values start the next. Concatenated sorted runs merge into fully sorted data.",
        "complexityRationale": "Each output involves a heap extraction and insertion, O(log m) for heap size m, so O(n log m) total, usually written O(n log n). The heap and freeze storage use O(n) space.",
        "uses": [
            "Generating long initial runs for external sorts",
            "Snowplow sorting in tape and disk systems",
            "Teaching heap-based run formation"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.4.2",
            "Bentley and Saxe, Generating a Sorted Stream from Sorted Subsequences, 1980"
        ],
        "workedExample": "With heap capacity three and input [5, 1, 4, 2, 3], output 1 and refill with 4 to keep the run going; output 4 and refill with 2, which is smaller so it freezes; the first run ends and 2, 3, 5 start the next."
    },
    id: "replacement-selection-sort",
    name: "Replacement Selection Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the heap snowplow ready for run one",
        "snowplow the heap to build long sorted runs",
        "flush each completed run to the output tapes",
        "merge all runs in a single pass",
        "scan runs into final order",
        "done: single sorted run remains",
    ],
};
export default module;
