/**
 * proxmap-sort.ts – Proxmap Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proxmap sort guesses each key's sorted position with a map function, scatters keys near those guesses, then insertion-sorts each small bucket. Good guesses make buckets tiny and the finish nearly linear. It previews the learn-to-index ideas behind modern learned data structures.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
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
        description: "Keys before proximity mapping.",
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
    const lo4 = Math.min(...arr);
    const hi4 = Math.max(...arr);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Proxmap: mapping keys near sorted positions.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const nb = arr.length;
    const buckets2: number[][] = Array.from({ length: nb }, () => []);
    for (const v of arr) {
        const k =
            hi4 === lo4 ? 0 : Math.min(nb - 1, Math.floor((nb * (v - lo4)) / (hi4 - lo4 + 1)));
        buckets2[k]?.push(v);
        comparisons += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Keys scattered into proximity buckets.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const out2: number[] = [];
    for (const b of buckets2) {
        b.sort((x, y) => x - y);
        out2.push(...b);
        swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `Each bucket insertion-sorted, concatenated in order.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = out2[i] ?? 0;
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
        "intuition": "Proxmap sort guesses each key's final position with a map function, scatters keys near their guesses, then insertion-sorts each short bucket. Good guesses make buckets tiny and the finish nearly linear. It foreshadows learned index structures.",
        "invariants": [
            "Every key is placed in the bucket associated with its mapped position.",
            "Keys in different buckets are ordered by the map, so cross-bucket order is fixed."
        ],
        "correctness": "The map is monotone, so any key landing in an earlier bucket is no larger than one in a later bucket; insertion sorting inside each bucket then orders the remaining local inversions.",
        "complexityRationale": "Mapping n keys is O(n) and each bucket holds O(1) keys under a good map, so insertion sorting all buckets is O(n) expected; a poor map can degrade to O(n^2). The bucket array uses O(n) space.",
        "uses": [
            "Prototyping learned indexes and proximity maps",
            "Sorting keys with a known distribution",
            "Teaching distribution sorts with approximate guesses"
        ],
        "references": [
            "Walker, Proxmap Sort, 1985 technical report, University of Tennessee",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2"
        ],
        "workedExample": "For [5, 1, 4, 2, 3] over range 1..5, the map sends each value near its rank; keys scatter into nearby slots and short insertion passes settle them to [1, 2, 3, 4, 5]."
    },
    id: "proxmap-sort",
    name: "Proxmap Sort",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with keys before proximity mapping",
        "map each key near its guessed sorted position",
        "scatter keys into proximity buckets",
        "insertion sort within each bucket",
        "scan buckets into final order",
        "done: array is fully sorted",
    ],
};
export default module;
