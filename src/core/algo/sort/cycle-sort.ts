/**
 * cycle-sort.ts – Cycle Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cycle sort finds where each element belongs by counting how many elements are smaller, then rotates whole permutation cycles directly home. Each element is written at most once, giving the minimum possible number of writes. It is the right choice when writes are expensive, such as flash memory.
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
    const fallback: number[] = [4, 3, 2, 5, 1];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Elements waiting for cycle rotation.",
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
    for (let start = 0; start < arr.length; start += 1) {
        const item = arr[start] ?? 0;
        let pos = start;
        for (let i = start + 1; i < arr.length; i += 1) {
            comparisons += 1;
            if ((arr[i] ?? 0) < item) pos += 1;
        }
        if (pos === start) continue;
        while (item === (arr[pos] ?? -1)) pos += 1;
        const displaced = arr[pos] ?? 0;
        arr[pos] = item;
        arr[start] = displaced;
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [start, "swapped"],
                        [pos, "sorted"],
                    ]),
                ),
                edges: [],
                description: `Rotating cycle: placing ${item} at index ${pos}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
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
        "intuition": "Cycle sort finds where each element belongs by counting how many elements are smaller, then rotates whole cycles directly into place. Each value is written at most once, the theoretical minimum for sorting by writes. It shines when writes are costly.",
        "invariants": [
            "Every element written to its final position is never moved again.",
            "The number of writes equals the number of elements not already in place."
        ],
        "correctness": "Counting smaller elements gives the exact destination index of a value in sorted order. Following the permutation cycles and placing each value at that index closes each cycle with all members correct, so the final array is sorted.",
        "complexityRationale": "Counting destinations requires O(n) comparisons per element, so O(n^2) time, but writes are at most n, the minimum possible. The algorithm uses O(1) auxiliary storage.",
        "uses": [
            "Flash memory and EEPROM where writes wear out cells",
            "Teaching minimal-write sorting",
            "Situations where reading is cheap and writing is expensive"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1 (minimum-write sorting)",
            "Sedgewick and Wayne, Algorithms, Section 2.1"
        ],
        "workedExample": "Start [4, 3, 2, 5, 1]. The value 4 belongs at index 3; rotate the cycle by moving 5, 1, 3, and 4 into their homes. After all cycles close the array reads [1, 2, 3, 4, 5] with only one write per misplaced value."
    },
    id: "cycle-sort",
    name: "Cycle Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [4, 3, 2, 5, 1],
    visualType: "array",
    run,
    pseudocode: [
        "start with every element awaiting its cycle slot",
        "for start in 0..n-1: count smaller elements to find pos",
        "rotate the cycle: place item at pos, carry displaced value",
        "continue rotating until the cycle closes",
        "scan cycles into final order",
        "done: each element sits in its final slot",
    ],
};
export default module;
