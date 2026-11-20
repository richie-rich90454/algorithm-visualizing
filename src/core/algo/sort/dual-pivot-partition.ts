/**
 * dual-pivot-partition.ts - Dual-Pivot Partition
 *
 * The partition step of dual-pivot quicksort (the Bentley-McIlroy scheme used
 * by Java's Arrays.sort for primitives). Two pivot values split the array into
 * three regions: values below the small pivot, values between the pivots, and
 * values above the large pivot. A three-way scan maintains the three regions
 * with one pointer for each frontier.
 *
 * Time O(n), space O(1), not stable.
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 4, 7, 2, 8, 3, 6, 1, 5];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    const n = arr.length;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, swaps, ...extra },
    });

    yield frame(new Map(), "Dual-pivot partition over the whole array.", 0);
    step += 1;

    if (n < 2) {
        yield frame(new Map(), "Fewer than two elements: partition is trivial.", 6, { n });
        return;
    }

    let p = arr[0]!;
    let q = arr[n - 1]!;
    if (p > q) {
        const tmp = arr[0]!;
        arr[0] = arr[n - 1]!;
        arr[n - 1] = tmp;
        const swapped = p;
        p = q;
        q = swapped;
        swaps += 1;
    }
    yield frame(
        new Map([
            [0, "pivot"],
            [n - 1, "pivot"],
        ]),
        `Chosen pivots p=${p} at index 0 and q=${q} at index ${n - 1}.`,
        1,
        { p, q },
    );
    step += 1;

    let i = 1;
    let lt = 1;
    let gt = n - 2;
    while (i <= gt) {
        const v = arr[i]!;
        comparisons += 1;
        if (v < p) {
            const tmp = arr[lt]!;
            arr[lt] = v;
            arr[i] = tmp;
            swaps += 1;
            yield frame(
                new Map([
                    [lt, "sorted"],
                    [i, "swapped"],
                    [0, "pivot"],
                    [n - 1, "pivot"],
                ]),
                `${v} < p: swap it into the low region ending at ${lt}.`,
                2,
                { p, q, i, lt, gt },
            );
            step += 1;
            lt += 1;
            i += 1;
        } else if (v > q) {
            const tmp = arr[gt]!;
            arr[gt] = v;
            arr[i] = tmp;
            swaps += 1;
            yield frame(
                new Map([
                    [gt, "visited"],
                    [i, "swapped"],
                    [0, "pivot"],
                    [n - 1, "pivot"],
                ]),
                `${v} > q: swap it into the high region starting at ${gt}.`,
                3,
                { p, q, i, lt, gt },
            );
            step += 1;
            gt -= 1;
        } else {
            yield frame(
                new Map([
                    [i, "active"],
                    [0, "pivot"],
                    [n - 1, "pivot"],
                ]),
                `${v} lies between the pivots: leave it in the middle region.`,
                4,
                { p, q, i, lt, gt },
            );
            step += 1;
            i += 1;
        }
    }

    const lowPivot = lt - 1;
    const highPivot = gt + 1;
    const tmpLow = arr[0]!;
    arr[0] = arr[lowPivot]!;
    arr[lowPivot] = tmpLow;
    const tmpHigh = arr[n - 1]!;
    arr[n - 1] = arr[highPivot]!;
    arr[highPivot] = tmpHigh;
    swaps += 2;

    const regions = new Map<number, EntityState>();
    for (let k = 0; k < n; k += 1) {
        if (k < lowPivot) regions.set(k, "sorted");
        else if (k === lowPivot || k === highPivot) regions.set(k, "pivot");
        else if (k > lowPivot && k < highPivot) regions.set(k, "highlight");
        else regions.set(k, "visited");
    }
    yield frame(
        regions,
        `Partition done: p=${p} at ${lowPivot}, q=${q} at ${highPivot}; three regions formed.`,
        6,
        {
            p,
            q,
            lowPivot,
            highPivot,
            lessCount: lowPivot,
            middleCount: highPivot - lowPivot - 1,
            greaterCount: n - highPivot - 1,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two pivots split the array into three regions instead of the two that a single pivot gives. A left frontier grows the low region, a right frontier grows the high region, and a scanning pointer leaves everything in between untouched. Swapping a value into a frontier either advances that frontier or, for the high region, leaves the scan pointer where it is because an unknown value just moved into the scan position.",
        invariants: [
            "Positions below lt hold values strictly less than p.",
            "Positions from lt up to i minus one hold values between p and q inclusive.",
            "Positions above gt hold values strictly greater than q.",
        ],
        correctness:
            "Each loop iteration examines one value and moves it into the region it belongs to, advancing the corresponding frontier while never disturbing the other two regions. When the scan pointer meets the right frontier the middle region fills the remaining positions. Moving the two pivots to the frontier boundaries places every smaller value before p, every larger value after q, and every intermediate value between them.",
        complexityRationale:
            "The scan pointer and the two frontiers move monotonically across the array, so each position is examined a constant number of times: O(n) time. Only the two pivots and three indices are stored, so space is O(1).",
        uses: [
            "The partition core of dual-pivot quicksort in Java's primitive sort",
            "Three-way splitting around a known lower and upper bound",
            "A build-up to multi-pivot quicksort designs",
        ],
        references: [
            "Bentley and McIlroy, Engineering a Sort Function, Software Practice and Experience, 1993",
            "Sedgewick and Bentley, Quicksort Is Optimal, 2012",
        ],
        workedExample:
            "For [3, 5, 1, 4, 2] the endpoints are out of order, so they swap to p=2 and q=3, giving [2, 5, 1, 4, 3]. The scan moves 5 and 4 into the high region and 1 into the low region. Placing the pivots on the region boundaries yields [1, 2, 3, 5, 4]: 1 is below p=2, the middle region is empty, and 5 and 4 are above q=3.",
    },
    id: "dual-pivot-partition",
    name: "Dual-Pivot Partition",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: [9, 4, 7, 2, 8, 3, 6, 1, 5],
    visualType: "array",
    run,
    pseudocode: [
        "start with the full array as one unclassified region",
        "choose endpoints as pivots p <= q, swapping if needed",
        "if value < p: swap into the low region and advance its frontier",
        "if value > q: swap into the high region and move its frontier left",
        "otherwise leave the value in the middle region",
        "stop when the scan meets the high frontier",
        "swap the pivots onto the two region boundaries",
        "done: three regions separated by p and q",
    ],
};

export default module;
