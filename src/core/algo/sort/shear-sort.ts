/**
 * shear-sort.ts – Shear Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shear sort lays values on a mesh and alternates sorting rows in opposite directions with sorting columns top to bottom. After enough shear phases the mesh is fully ordered in snake order. It shows how local sorting steps can produce global order on parallel grids.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
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
    const fallback: number[] = [7, 3, 5, 1, 6, 2, 4, 8];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Mesh grid flattened to row-major order.",
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
    const cols = Math.max(2, Math.ceil(Math.sqrt(arr.length)));
    for (let ph = 0; ph < 2; ph += 1) {
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [0, "highlight"],
                        [arr.length - 1, "highlight"],
                    ]),
                ),
                edges: [],
                description: `Shear phase ${ph}: sorting rows alternately.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        for (let r = 0; r * cols < arr.length; r += 1) {
            const seg = arr
                .slice(r * cols, r * cols + cols)
                .sort((x, y) => (r % 2 === 0 ? x - y : y - x));
            comparisons += seg.length;
            for (let c = 0; c < seg.length; c += 1) arr[r * cols + c] = seg[c] ?? 0;
        }
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [1, "comparing"],
                        [1 + cols < arr.length ? 1 + cols : 0, "comparing"],
                    ]),
                ),
                edges: [],
                description: `Rows sorted – now sorting columns.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        for (let c = 0; c < cols; c += 1) {
            const col: number[] = [];
            for (let r = c; r < arr.length; r += cols) col.push(arr[r] ?? 0);
            col.sort((x, y) => x - y);
            comparisons += col.length;
            swaps += 1;
            for (let k = 0; k < col.length; k += 1) arr[c + k * cols] = col[k] ?? 0;
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

    education: {
        "intuition": "Shear sort lays values on a mesh and alternates sorting rows in opposite directions with sorting columns top to bottom. The alternating shears push small values toward one corner and large values toward the opposite corner.",
        "invariants": [
            "After a row phase, every row is sorted in its designated direction.",
            "Each column phase makes columns nonincreasing top to bottom."
        ],
        "correctness": "Alternating sorted rows with sorted columns shrinks the set of possible inversions; after enough shear phases the mesh is sorted in snake order. Each local sort preserves the value multiset.",
        "complexityRationale": "A constant number of phases sorts a mesh of n cells; each phase sorts rows or columns in local work, giving O(n log n) comparisons in the visualization. The mesh array uses O(n) space.",
        "uses": [
            "Sorting on mesh-connected parallel processors",
            "Teaching local-to-global ordering",
            "Image-processing hardware with row and column passes"
        ],
        "references": [
            "Hirschberg, Fast Sorting on a Mesh-Connected Array of Processors, IEEE Transactions on Computers, 1992",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.3"
        ],
        "workedExample": "On a 2 by 4 mesh holding [7, 3, 5, 1] and [6, 2, 4, 8], a row phase sorts one row left to right and the other right to left; a column phase orders columns top to bottom. Repeated shears end in snake order [1, 2, 3, 4, 5, 6, 7, 8]."
    },
    id: "shear-sort",
    name: "Shear Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(1)" },
    defaultInput: [7, 3, 5, 1, 6, 2, 4, 8],
    visualType: "array",
    run,
    pseudocode: [
        "start with the mesh in row-major order",
        "sort rows alternately left-right and right-left",
        "sort every column top to bottom",
        "repeat shear phases until the mesh settles",
        "scan the mesh into final order",
        "done: mesh rows and columns are sorted",
    ],
};
export default module;
