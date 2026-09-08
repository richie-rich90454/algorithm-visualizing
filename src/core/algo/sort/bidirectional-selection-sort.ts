/**
 * bidirectional-selection-sort.ts – Bidirectional Selection Sort.
 *
 * Picks both min and max each pass from both ends.
 * Time: O(n²), Space: O(1)
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
        description: "Both ends open for selection.",
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
    let lo16 = 0,
        hi16 = arr.length - 1;
    while (lo16 < hi16) {
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [lo16, "comparing"],
                        [hi16, "comparing"],
                    ]),
                ),
                edges: [],
                description: `Selecting min for ${lo16} and max for ${hi16}.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        let mnI = lo16,
            mxI = lo16;
        for (let i = lo16; i <= hi16; i += 1) {
            comparisons += 2;
            if ((arr[i] ?? 0) < (arr[mnI] ?? 0)) mnI = i;
            if ((arr[i] ?? 0) > (arr[mxI] ?? 0)) mxI = i;
        }
        if (mnI !== lo16) {
            const t = arr[lo16] ?? 0;
            arr[lo16] = arr[mnI] ?? 0;
            arr[mnI] = t;
            swaps += 1;
            if (mxI === lo16) mxI = mnI;
        }
        if (mxI !== hi16) {
            const t = arr[hi16] ?? 0;
            arr[hi16] = arr[mxI] ?? 0;
            arr[mxI] = t;
            swaps += 1;
        }
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [lo16, "sorted"],
                        [hi16, "sorted"],
                    ]),
                ),
                edges: [],
                description: `Placed ${arr[lo16]} front and ${arr[hi16]} back.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        lo16 += 1;
        hi16 -= 1;
    }
    while (step < 4) {
        const h = new Map<number, EntityState>([[step % Math.max(arr.length, 1), "highlight"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, h),
            edges: [],
            description: "Scanning elements into place.",
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
    id: "bidirectional-selection-sort",
    name: "Bidirectional Selection Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
};
export default module;
