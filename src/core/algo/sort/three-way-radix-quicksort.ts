/**
 * three-way-radix-quicksort.ts - Three-Way Radix Quicksort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is an MSD radix quicksort: it looks at one decimal digit at a time,
 * starting from the most significant. At a given digit it uses a three-way
 * (Dutch national flag) partition to split the range into keys whose digit is
 * less than, equal to, or greater than the pivot digit. The less and greater
 * groups recurse on the same digit; the equal group recurses on the next
 * less-significant digit. It differs from comparison quicksort (which compares
 * whole keys) and from bucket radix sort (which never partitions in place).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(digits * n) typical, O(n^2) worst case
 *   Space: O(digits) for the recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current key values; the active range is highlighted.
 *   - The pivot digit is yellow, swapped bars are red, equal keys are pink.
 *   - Final frame marks every bar green.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    arr: number[],
    states: Map<number, EntityState> = new Map(),
    range?: [number, number],
): VisualEntity[] {
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
        metadata: { index, digit: range ? index : -1 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [170, 45, 75, 90, 802, 24, 2, 66];
    const n = arr.length;
    const min = n > 0 ? Math.min(...arr) : 0;
    const max = n > 0 ? Math.max(...arr) : 0;
    const keys = arr.map((v) => v - min);
    const maxKey = max - min;
    let divisor = 1;
    while (divisor * 10 <= maxKey) divisor *= 10;

    let step = 0;
    let partitions = 0;
    let swaps = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { partitions, swaps, divisor, n },
    });
    const rangeStates = (lo: number, hi: number, extra: Map<number, EntityState> = new Map()): Map<number, EntityState> => {
        const s = new Map(extra);
        for (let i = lo; i <= hi && i < n; i += 1) if (!s.has(i)) s.set(i, "comparing");
        return s;
    };

    yield snap("Initial array; digits are examined from most significant down.", 0, new Map());
    step += 1;

    function* sortRange(lo: number, hi: number, div: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi || div === 0) return;
        const pivotDigit = Math.floor((keys[lo] as number) / div) % 10;
        partitions += 1;
        yield snap(
            `Range [${lo},${hi}], divisor ${div}: pivot digit is ${pivotDigit}.`,
            2,
            rangeStates(lo, hi, new Map([[lo, "pivot"]])),
        );
        step += 1;

        let lt = lo;
        let i = lo;
        let gt = hi;
        while (i <= gt) {
            const digit = Math.floor((keys[i] as number) / div) % 10;
            if (digit < pivotDigit) {
                const t = arr[lt] as number;
                arr[lt] = arr[i] as number;
                arr[i] = t;
                const kt = keys[lt] as number;
                keys[lt] = keys[i] as number;
                keys[i] = kt;
                swaps += 1;
                yield snap(
                    `Digit ${digit} is below the pivot: swap positions ${lt} and ${i}.`,
                    4,
                    rangeStates(lo, hi, new Map([[lt, "swapped"], [i, "active"], [lo, "pivot"]])),
                );
                step += 1;
                lt += 1;
                i += 1;
            } else if (digit > pivotDigit) {
                const t = arr[i] as number;
                arr[i] = arr[gt] as number;
                arr[gt] = t;
                const kt = keys[i] as number;
                keys[i] = keys[gt] as number;
                keys[gt] = kt;
                swaps += 1;
                yield snap(
                    `Digit ${digit} is above the pivot: swap positions ${i} and ${gt}.`,
                    5,
                    rangeStates(lo, hi, new Map([[i, "active"], [gt, "swapped"], [lo, "pivot"]])),
                );
                step += 1;
                gt -= 1;
            } else {
                i += 1;
            }
        }

        yield snap(
            `Partitioned into less [${lo},${lt - 1}], equal [${lt},${gt}], greater [${gt + 1},${hi}].`,
            6,
            rangeStates(lo, hi, new Map([
                ...Array.from({ length: Math.max(0, lt - lo) }, (_, x) => [lo + x, "idle"] as [number, EntityState]),
                ...Array.from({ length: gt - lt + 1 }, (_, x) => [lt + x, "highlight"] as [number, EntityState]),
            ])),
        );
        step += 1;

        yield* sortRange(lo, lt - 1, div);
        yield* sortRange(lt, gt, Math.floor(div / 10));
        yield* sortRange(gt + 1, hi, div);
    }

    if (n > 0) yield* sortRange(0, n - 1, divisor);

    const all = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) all.set(i, "sorted");
    yield snap(`Sorted after ${partitions} partition(s) and ${swaps} swap(s).`, 8, all);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing whole numbers, compare them one decimal digit at a time from the most significant end. For the current digit, use a three-way split: numbers with a smaller digit go left, an equal digit stay in the middle, a larger digit go right. The left and right groups still disagree at this digit, so recurse on it; the middle group agrees here, so move on to the next digit. This is the in-place cousin of radix sort.",
        invariants: [
            "All keys in the left group have a smaller current digit than the pivot digit.",
            "All keys in the right group have a larger current digit.",
            "Within the middle group the current digits are all equal, so the next digit decides their order.",
        ],
        correctness:
            "At each call the three-way partition places every key into exactly the group determined by its current digit, which the Dutch national flag loop maintains by keeping indices lt, i and gt as group boundaries. Keys in the outer groups can be ordered by recursing on the same digit; keys in the equal group can only be ordered by a less significant digit, so recursing with divisor divided by ten is correct. When the divisor reaches zero all digits have been considered and the range is sorted. Keys are offset by the minimum so negatives map to nonnegative values without changing order.",
        complexityRationale:
            "Each partition scans its range once, and with d decimal digits a key can take part in at most one partition per digit level, giving O(d*n) expected time with O(n^2) worst-case behavior like quicksort. The recursion depth is at most the number of digits, so auxiliary space is O(d).",
        uses: [
            "In-place string sorting via multikey quicksort",
            "Sorting fixed-width integers without comparison branches",
            "A teaching example that unifies quicksort and radix ideas",
        ],
        references: [
            "Bentley and Sedgewick, Fast Algorithms for Sorting and Searching Strings, 1997",
            "Sedgewick, Algorithms in C, Parts 1-4, Section on radix exchange",
        ],
        workedExample:
            "For [170, 45, 75] offset by 45 the keys are [125, 0, 30]. With divisor 100 the pivot digit of 125 is 1: 0 and 30 have digit 0 and move left, 125 alone has digit 1. The equal group then recurses with divisor 10, and eventually the order [45, 75, 170] emerges.",
    },
    id: "three-way-radix-quicksort",
    name: "Three-Way Radix Quicksort",
    category: "sorting",
    complexity: { time: "O(d·n) typical", space: "O(d)" },
    defaultInput: { array: [170, 45, 75, 90, 802, 24, 2, 66] },
    visualType: "array",
    run,
    pseudocode: [
        "offset all keys by the minimum so they are nonnegative",
        "start with a divisor equal to the largest power of ten",
        "choose the current digit of the first key as the pivot digit",
        "three-way partition the range by digit less than, equal, or greater",
        "move a smaller-digit key into the low group",
        "move a larger-digit key into the high group",
        "leave equal-digit keys in the middle group",
        "recurse on low and high groups with the same divisor",
        "recurse on the equal group with divisor divided by ten",
        "done: the array is sorted",
    ],
};

export default module;
