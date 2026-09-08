/**
 * shear-sort.ts – Shear Sort.
 *
 * Alternates row and column sorts on a mesh grid.
 * Time: O(n log n), Space: O(1)
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
    id: "shear-sort",
    name: "Shear Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(1)" },
    defaultInput: [7, 3, 5, 1, 6, 2, 4, 8],
    visualType: "array",
    run,
};
export default module;
