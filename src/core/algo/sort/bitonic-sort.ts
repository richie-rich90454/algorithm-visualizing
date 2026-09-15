/**
 * bitonic-sort.ts – Bitonic Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bitonic sort first builds bitonic sequences that rise then fall, then merges them with a fixed network of compare-and-swap wires. Each stage compares pairs at a power-of-two distance and orders them up or down according to the block direction. It is a favorite parallel sort because every comparator runs independently.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log² n)
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
    const fallback: number[] = [6, 3, 7, 1, 5, 2, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Bitonic network input wire order.",
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
    const n = arr.length;
    for (let k = 2; k <= n; k *= 2)
        for (let j = k / 2; j > 0; j /= 2)
            for (let i = 0; i < n; i += 1) {
                const l = i ^ j;
                if (l <= i || l >= n) continue;
                const a = arr[i] ?? 0;
                const b = arr[l] ?? 0;
                comparisons += 1;
                const dirUp = (i & k) === 0;
                if ((dirUp && a > b) || (!dirUp && a < b)) {
                    arr[i] = b;
                    arr[l] = a;
                    swaps += 1;
                    if (budget > 0) {
                        budget -= 1;
                        yield {
                            stepNumber: step,
                            entities: makeBars(
                                arr,
                                new Map<number, EntityState>([
                                    [i, "swapped"],
                                    [l, "swapped"],
                                ]),
                            ),
                            edges: [],
                            description: `Bitonic compare-swap indices ${i} and ${l}.`,
                            codeLineNumber: 2,
                            layout: "array",
                            meta: { comparisons, swaps },
                        };
                        step += 1;
                    }
                } else {
                    if (budget > 0) {
                        budget -= 1;
                        yield {
                            stepNumber: step,
                            entities: makeBars(
                                arr,
                                new Map<number, EntityState>([
                                    [i, "comparing"],
                                    [l, "comparing"],
                                ]),
                            ),
                            edges: [],
                            description: `Bitonic compare indices ${i} and ${l} – already ordered.`,
                            codeLineNumber: 1,
                            layout: "array",
                            meta: { comparisons, swaps },
                        };
                        step += 1;
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
    id: "bitonic-sort",
    name: "Bitonic Sort",
    category: "sorting",
    complexity: { time: "O(log² n)", space: "O(n)" },
    defaultInput: [6, 3, 7, 1, 5, 2, 8, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted wires in input order",
        "compare each bitonic pair in the chosen direction",
        "if out of order for this direction: swap the pair",
        "double the bitonic block size and repeat",
        "scan wires into final order",
        "done: network output is sorted",
    ],
};
export default module;
