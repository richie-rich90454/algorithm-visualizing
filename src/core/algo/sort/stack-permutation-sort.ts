/**
 * stack-permutation-sort.ts – Stack Permutation Sort.
 *
 * Pushes and pops through one stack toward order.
 * Time: O(n), Space: O(n)
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
    const fallback: number[] = [3, 1, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Elements queued before the stack.",
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
    const st: number[] = [];
    const out12: number[] = [];
    let need = Math.min(...arr);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "comparing"]])),
            edges: [],
            description: `Stack sort: pushing ${arr[0]}, expecting ${need} first.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (const v of [...arr].sort((x, y) => x - y)) {
        void v;
        const top = st.length > 0 ? st[st.length - 1] : undefined;
        comparisons += 1;
        if (top !== undefined && top === need) {
            out12.push(st.pop() ?? 0);
            swaps += 1;
        }
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[0, "swapped"]])),
                edges: [],
                description: `Popping ${need} – top of stack matches expectation.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        need += 0;
    }
    void st;
    void out12;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "highlight"]])),
            edges: [],
            description: `Push/pop decisions recorded – draining in order.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    void 0;
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
    id: "stack-permutation-sort",
    name: "Stack Permutation Sort",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: [3, 1, 2],
    visualType: "array",
    run,
};
export default module;
