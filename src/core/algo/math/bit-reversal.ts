/**
 * bit-reversal.ts - Bit-Reversal Permutation of an Array.
 *
 * Reorders an array of length n = 2^k so that element i moves to the position
 * whose index is the binary reversal of i. The permutation is generated in O(n)
 * with the recurrence rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (k - 1)).
 *
 * Time O(n), space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function bars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: states.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function bits(value: number, width: number): string {
    return value.toString(2).padStart(width, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    let n = typeof task.n === "number" ? Math.trunc(task.n) : 8;
    if (n < 2 || (n & (n - 1)) !== 0) n = 8;
    const k = Math.log2(n);
    const rev: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i += 1) {
        rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (k - 1));
    }

    const arr: number[] = [];
    for (let i = 0; i < n; i += 1) arr.push(i);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(arr),
        edges: [],
        description: `Start with ${n} elements in index order; the index width is k=${k} bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, k, reversible: rev.slice(), swapped: 0 },
    };
    step += 1;

    let swapped = 0;
    for (let i = 0; i < n; i += 1) {
        const j = rev[i]!;
        const states = new Map<number, EntityState>();
        states.set(i, "comparing");
        if (j !== i) states.set(j, "active");
        if (j > i) {
            const tmp = arr[i]!;
            arr[i] = arr[j]!;
            arr[j] = tmp;
            swapped += 1;
        }
        yield {
            stepNumber: step,
            entities: bars(arr, states),
            edges: [],
            description: `Index ${i} (${bits(i, k)}) reverses to ${j} (${bits(j, k)}); element ${i} belongs at position ${j}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, k, index: i, reversed: j, swapped },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(arr, new Map(arr.map((_, i) => [i, "sorted" as EntityState]))),
        edges: [],
        description: `Done: the bit-reversed order is [${arr.join(", ")}] after ${swapped} swap(s).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, k, order: arr.slice(), swapped, reversible: rev.slice() },
    };
}

const module: AlgorithmModule = {
    id: "bit-reversal",
    name: "Bit-Reversal Permutation",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "let n = 2^k and rev[0] = 0",
        "derive each reversed index from the previous one using halves",
        "for i = 1 to n-1: rev[i] = (rev[i >> 1] >> 1) or ((i and 1) << (k-1))",
        "for i = 0 to n-1: if i < rev[i] then swap array[i], array[rev[i]]",
        "done: array is in bit-reversed index order",
    ],
    education: {
        intuition:
            "Writing each index in binary and reading the digits backwards gives a permutation with a useful property: a recursive even-odd split turns into contiguous halves. That is exactly the order a radix-2 FFT needs, so the shuffle can be done once up front.",
        invariants: [
            "n is a power of two, so every index has the same width k bits.",
            "rev is an involution: rev[rev[i]] equals i.",
            "Each element is moved at most once because swaps are done only when i < rev[i].",
        ],
        correctness:
            "The recurrence builds rev[i] from rev[i >> 1] by dropping its high bit and appending the low bit of i, which is precisely reversing one more binary digit. Because reversal is an involution, swapping each pair i < rev[i] places every element at its reversed position exactly once.",
        complexityRationale:
            "Computing all reversed indices takes one constant-time step per index, and the swap pass also visits each index once, giving O(n) time. The reverse table and array use O(n) space.",
        uses: [
            "Reordering inputs for iterative Cooley-Tukey FFT",
            "Number-theoretic transform implementations",
            "Interleaving and deinterleaving in communication systems",
        ],
        references: [
            "Cooley and Tukey, An Algorithm for the Machine Calculation of Complex Fourier Series, 1965",
            "Knuth, The Art of Computer Programming, Volume 3, Section 4.3.3",
        ],
        workedExample:
            "For n=8 (k=3), index 1 is 001 and reverses to 100 which is 4, while index 3 is 011 and reverses to 110 which is 6. Applying all swaps turns the array [0,1,2,3,4,5,6,7] into [0,4,2,6,1,5,3,7].",
    },
};

export default module;
