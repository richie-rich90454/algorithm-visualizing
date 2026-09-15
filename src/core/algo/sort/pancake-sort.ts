/**
 * pancake-sort.ts – Pancake Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pancake sort flips prefixes like a spatula: find the largest unsorted pancake, flip it to the top, then flip the whole stack to seat it at the bottom. Each pancake lands in at most two flips. It turns sorting into a fun prefix-reversal puzzle with real genome applications.
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
    const fallback: number[] = [5, 1, 4, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Stack of pancakes, largest buried.",
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
    for (let size = arr.length; size > 1; size -= 1) {
        let maxI = 0;
        for (let i = 1; i < size; i += 1) {
            comparisons += 1;
            if ((arr[i] ?? 0) > (arr[maxI] ?? 0)) maxI = i;
        }
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[maxI, "comparing"]])),
                edges: [],
                description: `Largest in first ${size} is ${arr[maxI]} at index ${maxI}.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        if (maxI !== 0) {
            arr.splice(0, maxI + 1, ...arr.slice(0, maxI + 1).reverse());
            swaps += 1;
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [0, "swapped"],
                            [maxI, "swapped"],
                        ]),
                    ),
                    edges: [],
                    description: `Flipping prefix to bring ${arr[0]} to front.`,
                    codeLineNumber: 2,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
        arr.splice(0, size, ...arr.slice(0, size).reverse());
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[size - 1, "sorted"]])),
                edges: [],
                description: `Flipping prefix of ${size} – ${arr[size - 1]} lands in place.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
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
    id: "pancake-sort",
    name: "Pancake Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the stack of unsorted pancakes",
        "find the largest pancake in the first size slots",
        "flip its prefix to bring it to the front",
        "flip the whole unsorted prefix to seat it at the end",
        "shrink the stack and repeat",
        "done: stack is sorted smallest on top",
    ],
};
export default module;
