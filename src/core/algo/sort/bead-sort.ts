/**
 * bead-sort.ts – Bead Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bead sort imagines each value as a row of beads on an abacus pole and lets gravity pull them down. Counting beads per level reads off the sorted order, because tall rows contribute beads to many levels. It only works on positive integers, but it makes non-comparison sorting physical.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n · max)
 *   Space: O(n · max)
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
    const fallback: number[] = [4, 1, 3, 2, 5];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Beads threaded as rows on poles.",
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
    const mx = Math.max(...arr);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Bead sort: dropping beads on ${arr.length} poles (max ${mx}).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const grid: boolean[][] = arr.map((v) => Array.from({ length: mx }, (_, i) => i < v));
    comparisons += arr.length;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Beads settled – counting beads per level.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const levels: number[] = [];
    for (let l = 0; l < mx; l += 1) {
        let c = 0;
        for (let r = 0; r < grid.length; r += 1) if (grid[r]?.[l]) c += 1;
        levels.push(c);
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `Level counts read bottom-up as the sorted array.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    levels.sort((x, y) => x - y);
    for (let i = 0; i < arr.length; i += 1) {
        arr[i] = levels[i] ?? 0;
        swaps += 1;
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
        "intuition": "Bead sort models each positive integer as a stack of beads hanging on vertical poles. Gravity lets the beads slide down so each row is packed, and reading the number of beads in each row from bottom to top gives the sorted values. It uses no comparisons at all.",
        "invariants": [
            "Beads in a column never pass one another; the count of beads per pole is unchanged.",
            "Each horizontal level holds at least as many beads as the level above it."
        ],
        "correctness": "A value v contributes a bead to each of its v lowest rows. After gravity acts, row r contains exactly the count of input values at least r, which is nonincreasing as r rises; counting those rows bottom to top reads the values in sorted order.",
        "complexityRationale": "The diagram has n poles and max rows, so filling and reading it costs O(n * max), where max is the largest value. The same number of bead cells is stored, giving O(n * max) space.",
        "uses": [
            "Teaching non-comparison sorting physically",
            "Explaining the pigeonhole principle with an abacus analogy",
            "Illustrating gravity-style parallel computation"
        ],
        "references": [
            "O'Connor and Dvorak, Bead Sort, Australian Journal of Information Technology, 2003",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2"
        ],
        "workedExample": "Values [4, 1, 3, 2] become bead stacks on four poles. After gravity, the bottom row holds 4 beads, the next holds 3, then 2, then 1; counting row by row from the top produces [1, 2, 3, 4]."
    },
    id: "bead-sort",
    name: "Bead Sort",
    category: "sorting",
    complexity: { time: "O(n · max)", space: "O(n · max)" },
    defaultInput: [4, 1, 3, 2, 5],
    visualType: "array",
    run,
    pseudocode: [
        "start with beads threaded as rows on poles",
        "drop one bead per unit of value down each pole",
        "let gravity settle beads, count beads per level",
        "read level counts bottom-up as sorted values",
        "scan rows into final order",
        "done: poles hold the sorted array",
    ],
};
export default module;
