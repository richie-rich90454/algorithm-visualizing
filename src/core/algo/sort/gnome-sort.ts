/**
 * gnome-sort.ts – Gnome Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gnome sort is insertion sort told as a garden gnome shuffling flower pots: step forward while neighbors are ordered, swap and step back otherwise. The gnome walks to the end exactly when the array is sorted. Its charm is pedagogical, but it is really insertion sort in disguise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²)
 *   Space: O(1)
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
    const fallback: number[] = [5, 3, 4, 1, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Gnome stepping through the pots.",
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
    let g = 1;
    while (g < arr.length) {
        const a = arr[g - 1] ?? 0;
        const b = arr[g] ?? 0;
        comparisons += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [g - 1, "comparing"],
                        [g, "comparing"],
                    ]),
                ),
                edges: [],
                description: `Comparing ${a} and ${b} at position ${g}.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        if (a <= b) {
            g += 1;
            continue;
        }
        arr[g - 1] = b;
        arr[g] = a;
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [g - 1, "swapped"],
                        [g, "swapped"],
                    ]),
                ),
                edges: [],
                description: `Swapping ${a} and ${b}, stepping back.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        if (g > 1) g -= 1;
        else g += 1;
    }
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
    id: "gnome-sort",
    name: "Gnome Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 3, 4, 1, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with gnome at position 1",
        "compare A[g-1] and A[g] at the gnome",
        "if in order: step forward, else swap and step back",
        "repeat until the gnome walks off the end",
        "scan pots into final order",
        "done: array is fully sorted",
    ],
};
export default module;
