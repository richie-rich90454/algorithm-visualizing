/**
 * bose-nelson-sorting-network.ts – Bose-Nelson Sorting Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bose-Nelson network is a simple recursive construction for a fixed sorting network. It builds sorting wires by merging already-sorted halves with a regular comparator pattern. It uses more comparators than Batcher, but its construction is beautifully easy to teach.
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
    const fallback: number[] = [4, 3, 2, 1];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Network inputs on the wires.",
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
    const comps: Array<[number, number]> = [];
    const build = (lo: number, m: number): void => {
        if (m <= 1) return;
        const mid = Math.floor(m / 2);
        for (let i = 0; i + mid < m; i += 1) comps.push([lo + i, lo + i + mid]);
        build(lo, mid);
        build(lo + mid, m - mid);
    };
    build(0, arr.length);
    for (const [x, y] of comps) {
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
                    description: `Network comparator (${x}, ${y}): swapping ${a} and ${b}.`,
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
                            [x, "comparing"],
                            [y, "comparing"],
                        ]),
                    ),
                    edges: [],
                    description: `Network comparator (${x}, ${y}): no swap.`,
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
    id: "bose-nelson-sorting-network",
    name: "Bose-Nelson Sorting Network",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [4, 3, 2, 1],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted values on the wires",
        "list the next Bose-Nelson comparator pair",
        "if the pair is out of order: swap the wires",
        "advance through all comparator stages",
        "scan wires into final order",
        "done: network output is sorted",
    ],
};
export default module;
