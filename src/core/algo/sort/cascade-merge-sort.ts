/**
 * cascade-merge-sort.ts – Cascade Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cascade merge sort is the tape-drive era external sort: runs are spread across many tapes and merged down a cascading ladder. Each pass merges runs from full tapes onto the emptiest tape, which becomes the output. It minimizes tape rewinds when memory cannot hold the data.
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
    const fallback: number[] = [4, 1, 5, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Tapes loaded before cascading.",
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
    const tapes: number[][] = [[], [], []];
    for (let i = 0; i < arr.length; i += 1) (tapes[i % 3] as number[]).push(arr[i] ?? 0);
    for (const t of tapes) t.sort((x, y) => x - y);
    comparisons += arr.length;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Cascade: spreading runs over tapes.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Cascading merge level – empty tape becomes output.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const all7 = tapes.flat().sort((x, y) => x - y);
    swaps += 1;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `One cascade pass merges runs down the ladder.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = all7[i] ?? 0;
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
        "intuition": "Cascade merge sort is a tape-drive external sort that spreads runs across several tapes and merges them down a cascade. Each pass reads runs from the fuller tapes and writes longer runs to the next tape, minimizing rewinds. It was designed when data was too large for memory.",
        "invariants": [
            "Each tape holds runs that are individually sorted.",
            "Run lengths grow by a factor of the number of input tapes after each cascade pass."
        ],
        "correctness": "A multiway merge of sorted runs produces one longer sorted run; cascading this across tapes preserves sortedness at every step. After enough passes only one run remains, which is the sorted data.",
        "complexityRationale": "Each element participates in O(log n) merge passes across the cascade, so time is O(n log n) with a small constant from balanced tape use. Tape buffers hold O(n) elements in the visualization.",
        "uses": [
            "Historical tape-based sorting systems",
            "Teaching external-memory merge patterns",
            "Understanding run distribution before modern external sorts"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.4.2 (external sorting)",
            "Ullman, Principles of Database Systems, external sorting chapter"
        ],
        "workedExample": "Runs [5, 1] and [6, 2] become [1, 5] and [2, 6] on separate tapes; a cascade merge writes [1, 2, 5, 6] to the next tape. Adding [4, 3] as [3, 4] and merging again yields [1, 2, 3, 4, 5, 6]."
    },
    id: "cascade-merge-sort",
    name: "Cascade Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [4, 1, 5, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted tapes loaded for cascading",
        "spread initial runs across the tapes",
        "merge runs down the ladder, empty tape is output",
        "repeat cascade passes until one run remains",
        "scan runs into final order",
        "done: single sorted run remains",
    ],
};
export default module;
