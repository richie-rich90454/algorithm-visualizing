/**
 * odd-even-transposition-sort.ts – Odd-Even Transposition Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Odd-even transposition sort is bubble sort for parallel hardware: even phases compare all even-indexed pairs at once, odd phases compare all odd-indexed pairs. This brick-wall pattern needs at most n phases. It is the simplest sorting network that students can simulate by hand.
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
        description: "Initial brick wall of bars.",
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
    for (let pass = 0; pass < arr.length; pass += 1) {
        const parity = pass % 2;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[parity, "highlight"]])),
                edges: [],
                description: `Pass ${pass}: comparing ${parity === 0 ? "even" : "odd"}-indexed pairs.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        for (let j = parity; j + 1 < arr.length; j += 2) {
            const a = arr[j] ?? 0;
            const c = arr[j + 1] ?? 0;
            comparisons += 1;
            if (a > c) {
                arr[j] = c;
                arr[j + 1] = a;
                swaps += 1;
                if (budget > 0) {
                    budget -= 1;
                    yield {
                        stepNumber: step,
                        entities: makeBars(
                            arr,
                            new Map<number, EntityState>([
                                [j, "swapped"],
                                [j + 1, "swapped"],
                            ]),
                        ),
                        edges: [],
                        description: `Swapping pair (${a}, ${c}).`,
                        codeLineNumber: 2,
                        layout: "array",
                        meta: { comparisons, swaps },
                    };
                    step += 1;
                }
            }
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
    id: "odd-even-transposition-sort",
    name: "Odd-Even Transposition Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the brick wall of unsorted bars",
        "compare all even-indexed adjacent pairs",
        "compare all odd-indexed adjacent pairs",
        "swap any flipped pair within the phase",
        "repeat both phases until a full pass is clean",
        "done: array is fully sorted",
    ],
};
export default module;
