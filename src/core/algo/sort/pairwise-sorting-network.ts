/**
 * pairwise-sorting-network.ts - Pairwise Sorting Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The pairwise sorting network of Ian Parberry sorts a fixed number of inputs
 * with a predetermined sequence of compare-exchange gates. It first sorts
 * adjacent pairs, then recursively sorts the odd and even positions so that
 * the pairs fall into lexicographic order, and finally merges the ordered
 * pairs. The compare schedule is independent of the data, which makes the
 * network suitable for hardware and for SIMD-style code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log^2 n) parallel depth, O(n log^2 n) sequential comparisons
 *   Space: O(n) for the array being sorted
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars taking part in the current layer are orange (comparing).
 *   - Bars that exchanged places in that layer are red (swapped).
 *   - All bars are green (sorted) in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NetworkTask {
    values?: number[];
}

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
    const task = (Array.isArray(input) ? { values: input as number[] } : (input as NetworkTask | null)) ?? {};
    const arr = Array.isArray(task.values) ? [...(task.values as number[])] : [9, 2, 7, 1, 8, 3, 6, 4];
    const n = arr.length;

    let step = 0;
    let comparators = 0;
    let layers = 0;

    const frame = (states: Map<number, EntityState>, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparators, layers, size: n },
    });

    yield frame(new Map(), `Pairwise network on ${n} input wires.`, 0);
    step += 1;
    if (n <= 1) {
        yield frame(new Map(arr.map((_, index) => [index, "sorted" as EntityState])), "At most one wire is already sorted.", 6);
        return;
    }

    let k = 1;
    while (k < n) k *= 2;

    yield frame(new Map(), `Padded network width is ${k}; gate layers follow the p and q loops.`, 1);
    step += 1;

    function* applyLayer(pairs: Array<[number, number]>, label: string): Generator<VisualFrame, void, unknown> {
        if (pairs.length === 0) return;
        const touched = new Set<number>();
        for (const [i, j] of pairs) {
            touched.add(i);
            touched.add(j);
        }
        yield frame(
            new Map([...touched].map((index) => [index, "comparing" as EntityState])),
            `${label}: ${pairs.length} compare-exchange gate(s) fire in parallel.`,
            2,
        );
        step += 1;

        const swapped = new Set<number>();
        for (const [i, j] of pairs) {
            comparators += 1;
            const left = arr[i] as number;
            const right = arr[j] as number;
            if (left > right) {
                arr[i] = right;
                arr[j] = left;
                swapped.add(i);
                swapped.add(j);
            }
        }
        layers += 1;
        yield frame(
            new Map([...swapped].map((index) => [index, "swapped" as EntityState])),
            swapped.size > 0
                ? `${label}: ${swapped.size} wire(s) exchanged values.`
                : `${label}: no exchange was needed.`,
            3,
        );
        step += 1;
    }

    for (let p = Math.floor(k / 2); p >= 1; p = Math.floor(p / 2)) {
        const first: Array<[number, number]> = [];
        for (let a = 0; a < n; a += 2 * p) {
            for (let b = 0; b < p; b += 1) {
                const i = a + b;
                const j = a + b + p;
                if (j < n) first.push([i, j]);
            }
        }
        yield* applyLayer(first, `p=${p}: sort aligned pairs`);

        for (let q = Math.floor(k / 2); q >= p * 2; q = Math.floor(q / 2)) {
            const second: Array<[number, number]> = [];
            for (let c = 0; c < n; c += 2 * p) {
                for (let d = 0; d < p; d += 1) {
                    const i = c + d + p;
                    const j = c + d + q;
                    if (j < n) second.push([i, j]);
                }
            }
            yield* applyLayer(second, `p=${p}, q=${q}: merge ordered pairs`);
        }
    }

    yield frame(
        new Map(arr.map((_, index) => [index, "sorted" as EntityState])),
        `Network finished: ${comparators} comparators across ${layers} layers.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sorting network is a fixed wiring of compare-exchange gates: whenever two wires meet, the smaller value goes to the upper wire. The pairwise network builds this wiring recursively. It sorts neighboring pairs, arranges the pairs into lexicographic order with odd and even subnetworks, and finally merges the ordered pairs into one sorted sequence.",
        invariants: [
            "A compare-exchange gate never moves the larger of its two inputs to the upper wire.",
            "Once a layer has run, each wire involved holds the smaller or larger of its original pair as appropriate.",
            "The gate schedule depends only on n, never on the input values.",
        ],
        correctness:
            "By the zero-one principle it is enough to check binary inputs. After the first layer every adjacent pair is sorted; the odd-even recursion puts pairs in lexicographic order, so a zero pair never sits below a one pair; the final merge layer removes the remaining inversions. Hence every input, not just binary input, is sorted.",
        complexityRationale:
            "The network has n(log n)(log n - 1)/4 + n - 1 comparators arranged in (log n)(log n + 1)/2 layers. Sequential execution therefore costs O(n log^2 n) comparisons, while hardware can execute one whole layer at a time in O(log^2 n) depth.",
        uses: [
            "Fixed-function sorting hardware and FPGA pipelines",
            "Sorting networks compiled into SIMD or GPU shaders",
            "Encoding cardinality constraints in SAT solvers",
        ],
        references: [
            "Parberry, The Pairwise Sorting Network, Parallel Processing Letters, 1992",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.3.4",
        ],
        workedExample:
            "For eight wires [9,2,7,1,8,3,6,4], the p=4 layer compares wires (0,4),(1,5),(2,6),(3,7) and swaps 9 with 4 and 7 with 3. The later p=2 and p=1 layers finish the merge, giving [1,2,3,4,6,7,8,9].",
    },
    id: "pairwise-sorting-network",
    name: "Pairwise Sorting Network",
    category: "sorting",
    complexity: { time: "O(n log^2 n)", space: "O(n)" },
    defaultInput: { values: [9, 2, 7, 1, 8, 3, 6, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "pad the wire count n up to a power of two k",
        "for p from k/2 down to 1",
        "compare-exchange wires (a+b, a+b+p) for aligned pairs",
        "for q from k/2 down to 2p: compare-exchange (c+d+p, c+d+q)",
        "advance to the next smaller p and repeat",
        "all compare-exchange gates have fired",
        "done: wires hold the values in ascending order",
    ],
};

export default module;
