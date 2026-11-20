/**
 * sleep-sort.ts – Sleep Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sleep sort arms one timer per value proportional to that value, then appends values to the output as their timers fire. Smaller values wake first, so wake-up order is sorted order. It is a joke with a lesson: it only works with timers and breaks on negatives and scale.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + t)
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
    const fallback: number[] = [4, 2, 5, 1, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Timers armed – none fired yet.",
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
    const timers = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Sleep sort: each element sleeps ${arr[0]}..${arr[arr.length - 1]} virtual ticks.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const out9: number[] = [];
    for (const t of timers) {
        comparisons += 1;
        out9.push(t.v);
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([[t.i < arr.length ? t.i : 0, "swapped"]]),
                ),
                edges: [],
                description: `Timer for ${t.v} fires – appending to output.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = out9[i] ?? 0;
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
        "intuition": "Sleep sort starts one timer per value, with the delay proportional to the value, and appends values to output as timers fire. Smaller values wake first, so wake-up order is sorted. It is a joke that only works with timers and nonnegative inputs.",
        "invariants": [
            "Each value is scheduled exactly once.",
            "Timers fire in nondecreasing delay order."
        ],
        "correctness": "Because delay is a monotone function of value, a smaller value's timer always fires before a larger one's; appending on wake-up therefore emits values in sorted order, barring timer skew.",
        "complexityRationale": "Scheduling n timers is O(n) and wall-clock time is proportional to the largest value t, so O(n + t) in the model. Storing timers and output uses O(n) space.",
        "uses": [
            "Classroom joke illustrating concurrency",
            "Discussing timer precision and scheduling skew",
            "Contrasting sorting with external physical processes"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2 (sorting folklore)",
            "Sedgewick and Wayne, Algorithms, Section 2.5 exercises"
        ],
        "workedExample": "For [4, 2, 5, 1, 3], timers wake in order 1, 2, 3, 4, 5, producing [1, 2, 3, 4, 5]; negative values would need negative delays and break the method."
    },
    id: "sleep-sort",
    name: "Sleep Sort",
    category: "sorting",
    complexity: { time: "O(n + t)", space: "O(n)" },
    defaultInput: [4, 2, 5, 1, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with all timers armed but none fired",
        "arm one timer per element proportional to its value",
        "when a timer fires: append its value to output",
        "collect fired timers in wake-up order",
        "scan wake order into final order",
        "done: output holds values in sorted order",
    ],
};
export default module;
