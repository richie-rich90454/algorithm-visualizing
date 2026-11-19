/**
 * radix-exchange-sort.ts - Radix Exchange Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Radix exchange sort is an in-place, most-significant-digit-first radix
 * sort. At each bit position it partitions the current range into values with
 * a 0 bit (moved left) and a 1 bit (moved right), using a Hoare-style two-way
 * scan. It then recurses on each half with the next lower bit. After the least
 * significant bit the array is fully sorted. It needs no bucket arrays and
 * works directly on the keys.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bits * n) where bits is the key width
 *   Space: O(bits) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The bit currently being tested is YELLOW (comparing).
 *   - The two scan pointers are PURPLE (pivot).
 *   - Ranges finished at the last bit are GREEN (sorted).
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 1, 7, 3, 0, 6, 2, 4];
    const n = arr.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array before radix exchange sort begins.",
        codeLineNumber: 0,
        layout: "array",
        meta: { n, bit: 0, partitions: 0 },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[0, "sorted"]])),
            edges: [],
            description: "Fewer than two elements are already sorted.",
            codeLineNumber: 7,
            layout: "array",
            meta: { n, bit: 0, partitions: 0 },
        };
        return;
    }

    const max = Math.max(...arr);
    let bits = 0;
    while ((1 << bits) <= max && bits < 31) {
        bits += 1;
    }
    if (bits === 0) {
        bits = 1;
    }
    let partitions = 0;

    function* exchange(lo: number, hi: number, bit: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi || bit < 0) {
            return;
        }
        let i = lo;
        let j = hi;

        const states = new Map<number, EntityState>([[i, "pivot"], [j, "pivot"]]);
        states.set(lo, "pivot");
        states.set(hi, "pivot");
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Partitioning range [${lo}..${hi}] on bit ${bit} (0 bits left, 1 bits right).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, bit, partitions, lo, hi },
        };
        step += 1;

        while (i <= j) {
            while (i <= j && (((arr[i] as number) >> bit) & 1) === 0) {
                i += 1;
            }
            while (i <= j && (((arr[j] as number) >> bit) & 1) === 1) {
                j -= 1;
            }
            if (i < j) {
                const tmp = arr[i] as number;
                arr[i] = arr[j] as number;
                arr[j] = tmp;
                const swapStates = new Map<number, EntityState>([[i, "swapped"], [j, "swapped"]]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `Swapped values at ${i} and ${j} to fix their bit-${bit} sides.`,
                    codeLineNumber: 2,
                    layout: "array",
                    meta: { n, bit, partitions, lo, hi },
                };
                step += 1;
                i += 1;
                j -= 1;
            } else {
                break;
            }
        }
        partitions += 1;

        yield* exchange(lo, j, bit - 1);
        yield* exchange(i, hi, bit - 1);
    }

    yield* exchange(0, n - 1, bits - 1);

    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `Array sorted by radix exchange over ${bits} bits and ${partitions} partitions.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, bit: bits, partitions, sorted: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sort numbers one bit at a time, starting from the most significant bit. At each bit, sweep from both ends and swap any misplaced value so that everything with a 0 in that bit moves left and everything with a 1 moves right. Recurse into both halves with the next bit, just like quick sort whose pivot test is a single bit.",
        invariants: [
            "Within a range, all values before the split have a 0 in the current bit and all after have a 1.",
            "Higher bits are already final for every value in the current range.",
            "The two scan pointers never cross without finishing the partition.",
        ],
        correctness:
            "The two-way scan leaves the range partitioned by the current bit. Values in the 0-half and 1-half agree on all higher bits, so sorting each half by the remaining lower bits orders them completely. By induction down to the least significant bit the entire array is sorted.",
        complexityRationale:
            "There are bits levels and each level scans each element once with constant work, giving O(bits * n) time. Only the recursion stack is stored, one frame per bit level, so space is O(bits).",
        uses: [
            "In-place integer sorting without bucket arrays",
            "Embedded and memory-constrained runtimes",
            "A teaching bridge between radix sort and quick sort partitioning",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 3, Section 5.2 (radix exchange)",
            "Wikipedia, Radix sort, in-place most-significant-digit variant",
        ],
        workedExample:
            "For [5, 1, 7, 3] with three bits, the 4-bit partition sends 1 and 3 left and 5 and 7 right. The next bit separates 1 from 3 and 5 from 7, and the final bit settles ties, producing [1, 3, 5, 7].",
    },
    id: "radix-exchange-sort",
    name: "Radix Exchange Sort",
    category: "sorting",
    complexity: { time: "O(bits * n)", space: "O(bits)" },
    defaultInput: [5, 1, 7, 3, 0, 6, 2, 4],
    visualType: "array",
    run,
    pseudocode: [
        "find the number of bits in the largest value",
        "partition the range on the highest remaining bit",
        "sweep right while the value's bit is zero",
        "sweep left while the value's bit is one",
        "swap the two misplaced values and keep scanning",
        "recurse on the zero half and the one half with the next bit",
        "base case: one element or no bits remaining",
        "done: the array is sorted",
    ],
};

export default module;
