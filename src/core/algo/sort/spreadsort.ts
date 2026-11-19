/**
 * spreadsort.ts - Spreadsort
 *
 * An integer distribution sort that keeps splitting on the leading bits of the
 * current range. For each subrange it picks a power-of-two number of bins based
 * on how many elements remain, spreads the keys into those bins by a right
 * shift, and recurses until the bins are small enough for insertion sort. It is
 * the algorithm behind Boost.Spreadsort: unlike plain radix sort the bin count
 * and shift adapt to the data at every level.
 *
 * Time O(n log n) typical, O(n^2) worst; space O(n).
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

function bitLength(value: number): number {
    return value <= 0 ? 0 : Math.floor(Math.log2(value)) + 1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [170, 45, 75, 90, 0, 24, 2, 66, 12, 30, 100, 5];
    let step = 0;
    let comparisons = 0;
    let moves = 0;
    let budget = 30;
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
        meta: { comparisons, moves, ...extra },
    });
    const pending: VisualFrame[] = [];
    const emit = (states: Map<number, EntityState>, d: string, line: number, extra: Record<string, number | string | boolean>): void => {
        if (budget > 0) {
            budget -= 1;
            const f = frame(states, d, line, extra);
            f.stepNumber = pending.length;
            pending.push(f);
        }
    };

    yield frame(new Map(), "Spreadsort: repeatedly split ranges by the keys' leading bits.", 0, { n });
    step += 1;
    if (n < 2) {
        yield frame(new Map(), "Fewer than two elements: already sorted.", 6, { n });
        return;
    }

    function insertionSort(lo: number, hi: number): void {
        for (let i = lo + 1; i < hi; i += 1) {
            const key = arr[i]!;
            let j = i - 1;
            comparisons += 1;
            while (j >= lo && arr[j]! > key) {
                arr[j + 1] = arr[j]!;
                comparisons += 1;
                moves += 1;
                j -= 1;
            }
            arr[j + 1] = key;
            moves += 1;
        }
    }

    function spreadSort(lo: number, hi: number): void {
        const size = hi - lo;
        if (size <= 16) {
            insertionSort(lo, hi);
            const done = new Map<number, EntityState>();
            for (let k = lo; k < hi; k += 1) done.set(k, "sorted");
            emit(done, `Range [${lo}, ${hi}) fits in one leaf: finish with insertion sort.`, 3, { rangeLo: lo, rangeHi: hi });
            return;
        }

        let rangeMin = arr[lo]!;
        let rangeMax = arr[lo]!;
        for (let k = lo + 1; k < hi; k += 1) {
            comparisons += 1;
            if (arr[k]! < rangeMin) rangeMin = arr[k]!;
            if (arr[k]! > rangeMax) rangeMax = arr[k]!;
        }
        if (rangeMin === rangeMax) {
            const equal = new Map<number, EntityState>();
            for (let k = lo; k < hi; k += 1) equal.set(k, "sorted");
            emit(equal, `Every key in [${lo}, ${hi}) equals ${rangeMin}: no spread needed.`, 3, {
                rangeLo: lo,
                rangeHi: hi,
            });
            return;
        }

        const bins = 2 ** Math.ceil(Math.log2(size));
        const shift = Math.max(0, bitLength(rangeMax - rangeMin) - Math.log2(bins));
        const divisor = 2 ** shift;
        const binOf = (value: number): number =>
            Math.max(0, Math.min(bins - 1, Math.floor((value - rangeMin) / divisor)));

        const counts = new Array<number>(bins).fill(0);
        for (let k = lo; k < hi; k += 1) counts[binOf(arr[k]!)]! += 1;

        const starts: number[] = [];
        let acc = lo;
        for (let b = 0; b < bins; b += 1) {
            starts[b] = acc;
            acc += counts[b]!;
        }
        const cursor = starts.slice();
        const scratch = new Array<number>(n);
        for (let k = lo; k < hi; k += 1) {
            const b = binOf(arr[k]!);
            scratch[cursor[b]!] = arr[k]!;
            cursor[b] = cursor[b]! + 1;
        }
        for (let k = lo; k < hi; k += 1) {
            arr[k] = scratch[k]!;
            moves += 1;
        }
        const spreadStates = new Map<number, EntityState>();
        for (let k = lo; k < hi; k += 1) spreadStates.set(k, "comparing");
        emit(
            spreadStates,
            `Range [${lo}, ${hi}): spread ${size} keys into ${bins} bins using a ${shift}-bit shift.`,
            2,
            { rangeLo: lo, rangeHi: hi, binCount: bins, shift, min: rangeMin, max: rangeMax },
        );

        for (let b = 0; b < bins; b += 1) {
            const count = counts[b]!;
            if (count > 1) spreadSort(starts[b]!, starts[b]! + count);
        }
    }

    spreadSort(0, n);

    for (const f of pending) {
        f.stepNumber = step;
        step += 1;
        yield f;
    }

    const final = new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"] as [number, EntityState]));
    yield frame(final, `Spreadsort finished ${n} keys in ${comparisons} comparisons and ${moves} moves.`, 6, {
        comparisons,
        moves,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Spreadsort sorts integers by looking at several top bits at once. At each level it chooses a number of bins roughly equal to the number of elements left, so a large range is cut into many small pieces in a single pass. Within each piece the shift grows, exposing lower bits, until the piece is small enough for insertion sort to finish cheaply.",
        invariants: [
            "Every key in a bin shares the same leading bits selected by the current shift.",
            "Bins are stored contiguously in increasing order, so keys of a lower bin precede keys of a higher bin.",
            "The multiset of keys in a range is unchanged by a spread step.",
        ],
        correctness:
            "Because the bin index is a monotonic function of the key, distributing keys into bins in index order groups them by their leading bits in ascending order. Recursing on each bin applies the same argument to the remaining lower bits, and insertion sort orders the final small leaves. Induction on the recursion depth gives a fully sorted range.",
        complexityRationale:
            "Each level scans its range a constant number of times and total work per level is O(n). Choosing as many bins as elements limits the depth to O(log n) on well-spread data; badly clustered keys can create deep chains and O(n^2) time. Each level needs an auxiliary array of n slots, so space is O(n).",
        uses: [
            "Fast in-memory sorting of integer keys in the Boost.Sort library",
            "Sorting large numeric arrays where radix passes are cheaper than comparisons",
            "A practical bridge between radix distribution and comparison sorts",
        ],
        references: [
            "Ross, Spreadsort (Boost.Sort documentation), 2002-2015",
            "Sedgewick and Wayne, Algorithms, Section 2.5 (radix and bucket methods)",
        ],
        workedExample:
            "For [170, 45, 75, 90, 0, 24] with six keys, spreadsort uses eight bins. Relative to the minimum 0, keys fall into bins 5, 1, 2, 2, 0, 0; the empty bins are skipped and the two populated small bins are finished by insertion sort, yielding [0, 24, 45, 75, 90, 170].",
    },
    id: "spreadsort",
    name: "Spreadsort",
    category: "sorting",
    complexity: { time: "O(n log n) typical", space: "O(n)" },
    defaultInput: [170, 45, 75, 90, 0, 24, 2, 66, 12, 30, 100, 5],
    visualType: "array",
    run,
    pseudocode: [
        "start with the whole range of integer keys",
        "if the range is small, finish with insertion sort",
        "choose a power-of-two bin count from the range size",
        "shift each key by the leading-bit width to pick its bin",
        "count keys per bin and scatter them into contiguous bins",
        "recurse on each bin holding more than one key",
        "done: the concatenated bins are sorted",
    ],
};

export default module;
