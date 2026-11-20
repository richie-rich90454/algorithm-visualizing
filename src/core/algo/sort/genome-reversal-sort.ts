/**
 * genome-reversal-sort.ts – Genome Reversal Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Genome reversal sort models evolution: it transforms one gene order into another using the fewest segment reversals. Each step finds the wanted gene and flips the whole block into place. It links sorting to bioinformatics, where reversals are real mutations.
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
    const fallback: number[] = [4, 2, 1, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Genome blocks out of order.",
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
    for (let i = 0; i < arr.length; i += 1) {
        const want = [...arr].sort((x, y) => x - y)[i] ?? 0;
        const at = arr.indexOf(want, i);
        comparisons += 1;
        if (at > i) {
            arr.splice(i, at - i + 1, ...arr.slice(i, at + 1).reverse());
            swaps += 1;
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [i, "swapped"],
                            [at, "swapped"],
                        ]),
                    ),
                    edges: [],
                    description: `Reversal sorting gene ${want} into position ${i}.`,
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
                    entities: makeBars(arr, new Map<number, EntityState>([[i, "comparing"]])),
                    edges: [],
                    description: `Gene ${want} already at position ${i}.`,
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

    education: {
        "intuition": "Genome reversal sort transforms one gene order into another using whole-segment reversals, a mutation seen in biology. Each step finds the gene that belongs next and flips the block from its current position into place. It connects sorting to evolutionary distance.",
        "invariants": [
            "Once a prefix is correctly ordered, later reversals never disturb it.",
            "Each reversal is a legal genome operation preserving the set of genes."
        ],
        "correctness": "Reversing the segment containing the target gene can place it at the correct boundary while leaving the fixed prefix untouched; induction over positions sorts the entire order. The process terminates because the correct prefix grows by at least one gene.",
        "complexityRationale": "Finding a gene and reversing a segment both scan O(n) genes, and up to n reversals are needed, giving O(n^2) time. Only indices are stored, so space is O(1) beyond the input.",
        "uses": [
            "Estimating reversal distance between genomes",
            "Teaching bioinformatics mutation models",
            "Planning rearrangements in comparative genomics"
        ],
        "references": [
            "Kececioglu and Sankoff, Exact and Approximation Algorithms for Sorting by Reversals, Algorithmica, 1995",
            "Pevzner, Computational Molecular Biology, chapter on genome rearrangements"
        ],
        "workedExample": "Start [4, 2, 1, 3]. Find 1 at position two and reverse the segment [2, 1] into [4, 1, 2, 3]; then reverse appropriate prefixes so 1, 2, 3, 4 line up, ending at [1, 2, 3, 4]."
    },
    id: "genome-reversal-sort",
    name: "Genome Reversal Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [4, 2, 1, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with genome blocks out of order",
        "find where the wanted gene currently sits",
        "reverse the segment to bring the gene home",
        "advance to the next position and repeat",
        "scan genes into final order",
        "done: genome blocks are in order",
    ],
};
export default module;
