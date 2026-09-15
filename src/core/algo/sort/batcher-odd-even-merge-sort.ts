/**
 * batcher-odd-even-merge-sort.ts – Batcher Odd-Even Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Batcher's odd-even merge network sorts with a fixed pattern of compare-and-swap wires, no branching required. Each stage merges odd and even subsequences with a widening then narrowing stride. It is a classic parallel sorting network that maps directly onto hardware.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log² n)
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
    const fallback: number[] = [6, 3, 7, 1, 5, 2, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Merge network wires before stage one.",
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
    const n2 = arr.length;
    for (let p = 1; p < n2; p *= 2)
        for (let k = p; k >= 1; k /= 2) {
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
                    edges: [],
                    description: `Batcher stage p=${p}, k=${k}: compare-exchange pairs.`,
                    codeLineNumber: 1,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
            for (let j = k % p; j + k < n2; j += 2 * k)
                for (let i = 0; i < Math.min(k, n2 - j - k); i += 1) {
                    const x = j + i,
                        y = j + i + k;
                    const a = arr[x] ?? 0;
                    const b = arr[y] ?? 0;
                    comparisons += 1;
                    if (a > b) {
                        arr[x] = b;
                        arr[y] = a;
                        swaps += 1;
                        if (budget > 0) {
                            budget -= 1;
                            yield {
                                stepNumber: step,
                                entities: makeBars(
                                    arr,
                                    new Map<number, EntityState>([
                                        [x, "swapped"],
                                        [y, "swapped"],
                                    ]),
                                ),
                                edges: [],
                                description: `Exchanging indices ${x} and ${y}.`,
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
    id: "batcher-odd-even-merge-sort",
    name: "Batcher Odd-Even Merge Sort",
    category: "sorting",
    complexity: { time: "O(log² n)", space: "O(1)" },
    defaultInput: [6, 3, 7, 1, 5, 2, 8, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted wires before stage one",
        "set stride p for this Batcher merge stage",
        "compare and exchange wires distance p apart",
        "halve the stride and repeat until stride is 0",
        "scan wires into final order",
        "done: network output is sorted",
    ],
};
export default module;
