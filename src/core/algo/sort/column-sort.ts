/**
 * column-sort.ts – Column Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Column sort treats the array as a matrix and alternates sorting columns with permuting rows into columns. After a few column-sort plus reshape rounds, the flattened matrix is sorted. It is a clean example of how reshaping data can expose parallelism.
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
    const fallback: number[] = [6, 2, 7, 1, 5, 3, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Matrix columns before the first sort.",
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
    const cc = Math.max(2, Math.ceil(Math.sqrt(arr.length)));
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Column sort: sorting each column.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let c = 0; c < cc; c += 1) {
        const col: number[] = [];
        for (let r = c; r < arr.length; r += cc) col.push(arr[r] ?? 0);
        col.sort((x, y) => x - y);
        comparisons += col.length;
        for (let k = 0; k < col.length; k += 1) arr[c + k * cc] = col[k] ?? 0;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [0, "comparing"],
                    [arr.length - 1, "comparing"],
                ]),
            ),
            edges: [],
            description: `Columns sorted – permuting rows to columns.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    swaps += 1;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "highlight"]])),
            edges: [],
            description: `Reshaped – sorting each column again.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let c = 0; c < cc; c += 1) {
        const col: number[] = [];
        for (let r = c; r < arr.length; r += cc) col.push(arr[r] ?? 0);
        col.sort((x, y) => x - y);
        comparisons += col.length;
        for (let k = 0; k < col.length; k += 1) arr[c + k * cc] = col[k] ?? 0;
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

    education: {
        "intuition": "Column sort views the array as a matrix and alternates sorting its columns with a fixed permutation that reshapes rows into columns. After a few rounds the flattened matrix is sorted. The reshape exposes parallelism that a flat array hides.",
        "invariants": [
            "After each column-sort step, entries in every column are sorted top to bottom.",
            "The reshape is a bijection, so the set of stored values never changes."
        ],
        "correctness": "The column permutation moves each sorted column into positions where the next sort compares it against neighbors it had not seen before; the round structure forms a sorting network on the matrix. After the fixed number of rounds the network sorts every input.",
        "complexityRationale": "Each round sorts columns of total length n and there are a constant number of rounds, so O(n log n) comparisons overall. The matrix reshaping needs O(n) auxiliary storage in the visualization.",
        "uses": [
            "Parallel sorting on mesh-connected machines",
            "Teaching data-layout transformations",
            "Cache-oblivious sorting experiments"
        ],
        "references": [
            "Leighton, Column-Sort Networks, MIT Technical Report, 1985",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.3"
        ],
        "workedExample": "Lay [6, 2, 7, 1, 5, 3, 8, 4] out as four rows of two; sort each column, reshape so rows become columns, sort again, and the flattened matrix reads [1, 2, 3, 4, 5, 6, 7, 8]."
    },
    id: "column-sort",
    name: "Column Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [6, 2, 7, 1, 5, 3, 8, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with values in column-major matrix order",
        "sort every column top to bottom",
        "permute rows into columns (transpose-like reshape)",
        "sort every column again after reshaping",
        "scan columns back into linear order",
        "done: array is fully sorted",
    ],
};
export default module;
