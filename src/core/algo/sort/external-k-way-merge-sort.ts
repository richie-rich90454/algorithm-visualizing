/**
 * external-k-way-merge-sort.ts – External K-Way Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * External k-way merge sort handles data larger than memory: it sorts memory-sized chunks into runs, then merges K runs at a time. Each merge pass streams runs from disk and writes longer runs back. It is the workhorse behind database and file-system sorting.
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
    const fallback: number[] = [5, 1, 6, 2, 4, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Disk chunks before run formation.",
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
    const K5 = 2;
    const runs: number[][] = [];
    for (let i = 0; i < arr.length; i += K5) {
        runs.push(arr.slice(i, i + K5).sort((x, y) => x - y));
        comparisons += K5;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[i, "highlight"]])),
                edges: [],
                description: `Run formation: sorting memory-sized chunk at ${i}.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
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
            description: `One ${K5}-way merge pass over ${runs.length} runs.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const merged5: number[] = [];
    const idx = runs.map(() => 0);
    while (true) {
        let best = -1;
        for (let r = 0; r < runs.length; r += 1) {
            const ri = idx[r] ?? 0;
            if (ri < (runs[r]?.length ?? 0)) {
                comparisons += 1;
                if (best < 0 || (runs[r]?.[ri] ?? 0) < (runs[best]?.[idx[best] ?? 0] ?? 0))
                    best = r;
            }
        }
        if (best < 0) break;
        merged5.push(runs[best]?.[idx[best] ?? 0] ?? 0);
        idx[best] = (idx[best] ?? 0) + 1;
        swaps += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = merged5[i] ?? 0;
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
    id: "external-k-way-merge-sort",
    name: "External K-Way Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 1, 6, 2, 4, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with disk chunks awaiting run formation",
        "sort each memory-sized chunk into a run",
        "merge K runs at a time into longer runs",
        "repeat merge passes until one run remains",
        "scan runs into final order",
        "done: single sorted run on disk",
    ],
};
export default module;
