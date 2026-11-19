/**
 * fibonacci-coding.ts – Fibonacci coding via Zeckendorf representation.
 *
 * Every positive integer has a unique Zeckendorf representation: a sum of
 * nonconsecutive Fibonacci numbers. Writing those digits from smallest to
 * largest Fibonacci number and appending a terminating 1 yields a prefix code
 * whose codes always end in two consecutive 1 bits.
 *
 *  Time:  O(log n) bits per value
 *  Space: O(total bits emitted)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function fibsUpTo(n: number): number[] {
    const f = [1, 2];
    while (f[f.length - 1]! < n) {
        f.push(f[f.length - 1]! + f[f.length - 2]!);
    }
    return f;
}

function encode(n: number): string {
    const f = fibsUpTo(n);
    const digits = new Array<number>(f.length).fill(0);
    let rem = n;
    for (let i = f.length - 1; i >= 0; i -= 1) {
        if (f[i]! <= rem) {
            digits[i] = 1;
            rem -= f[i]!;
        }
    }
    // Emit from the smallest Fibonacci number up to the highest set digit,
    // then a sentinel. Stopping at the top digit keeps the code ending in 11.
    const top = digits.lastIndexOf(1);
    return digits.slice(0, top + 1).join("") + "1";
}

function decode(bits: string): number[] {
    const out: number[] = [];
    let start = 0;
    for (let i = 1; i < bits.length; i += 1) {
        if (bits[i - 1] === "1" && bits[i] === "1") {
            const digits = bits.slice(start, i);
            const f = fibsUpTo(1 << 20);
            let sum = 0;
            for (let j = 0; j < digits.length && j < f.length; j += 1) {
                if (digits[j] === "1") sum += f[j]!;
            }
            out.push(sum);
            start = i + 1;
            i += 1;
        }
    }
    return out;
}

function bitEntities(bits: string): VisualEntity[] {
    if (bits.length === 0) {
        return [{
            id: "bit-empty", type: "character" as const, label: "empty", value: "empty",
            state: "idle" as EntityState, x: 0, y: 0, width: 0, height: 0, metadata: { index: 0 },
        }];
    }
    return [...bits].map((b, i) => ({
        id: `bit-${i}`, type: "character" as const, label: b, value: b,
        state: "sorted" as EntityState, x: 0, y: 0, width: 0, height: 0, metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { numbers?: number[] } | null) ?? {};
    const numbers = Array.isArray(cfg.numbers)
        ? cfg.numbers.filter((n) => Number.isInteger(n) && n >= 1).slice(0, 8)
        : [1, 2, 3, 4, 5, 6];
    if (numbers.length === 0) numbers.push(1);

    const codes = numbers.map(encode);
    const stream = codes.join("");
    const decoded = decode(stream);
    const roundTrip = decoded.join(",") === numbers.join(",");
    const lines = 7;
    let step = 0;
    const F = (entities: VisualEntity[], description: string, line: number, bits: string): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { bits, roundTrip, count: numbers.length },
    });

    yield F(bitEntities(stream), `Fibonacci stream for [${numbers.join(", ")}] has ${stream.length} bits.`, 0, stream);
    step += 1;
    for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i] as number;
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n} has Zeckendorf digits "${(codes[i] ?? "").slice(0, -1)}" (smallest first), code "${codes[i]}".`,
            i + 1,
            codes.slice(0, i + 1).join(""),
        );
        step += 1;
    }
    yield F(
        bitEntities(stream),
        `Every code ends in 11, so the stream decodes to [${decoded.join(", ")}] (match: ${roundTrip}).`,
        numbers.length + 1,
        stream,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition: "Fibonacci coding writes a number as a sum of nonconsecutive Fibonacci numbers, its Zeckendorf representation. Listing those digits from the smallest Fibonacci number upward and adding a final 1 marker makes the code self-delimiting, because the only place two 1 bits can touch is the end of a code.",
        invariants: [
            "The Zeckendorf digits of a value never contain two adjacent 1 bits.",
            "Every emitted code ends with the pair 11: the largest set digit followed by the sentinel.",
            "Decoding the concatenated stream recovers the original positive integers."
        ],
        correctness: "Zeckendorf's theorem guarantees a unique representation with no consecutive Fibonacci numbers. Because of that, two adjacent 1 bits can occur only where the highest digit meets the appended sentinel, so a decoder can split the stream on each 11 boundary. Removing the sentinel and weighting the remaining digits by Fibonacci numbers reconstructs the value uniquely.",
        complexityRationale: "The largest Fibonacci number needed for n is about 2.618 to the power log n, so the representation has O(log n) digits and each code uses O(log n) bits. Greedy decomposition and decoding scan those digits, giving linear time in the emitted bit length.",
        uses: [
            "Prefix codes for positive integers in data compression",
            "Self-synchronizing codes in bitstreams",
            "Integer coding in some image and text compressors",
            "Teaching canonical number representation"
        ],
        references: [
            "Zeckendorf, Representation des nombres naturels, 1972",
            "Knuth, The Art of Computer Programming, Vol. 1, Fibonacci number systems"
        ],
        workedExample: "The number 4 equals Fibonacci 3 plus Fibonacci 1. With Fibonacci numbers 1, 2, 3, 5 listed smallest first, the digits are 1, 0, 1, so the code is 101 followed by the sentinel 1, giving 1011. Decoding 1011 splits at the final 11, reads digits 101 as 1*1 plus 0*2 plus 1*3, and recovers 4."
    },
    id: "fibonacci-coding",
    name: "Fibonacci Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [1, 2, 3, 4, 5, 6] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each positive value n build Fibonacci numbers up to n",
        "greedily subtract largest nonconsecutive Fibonacci numbers",
        "write digits smallest Fibonacci first then a sentinel one",
        "append the code to the growing stream",
        "split the stream at each pair of adjacent ones",
        "weight remaining digits by Fibonacci numbers and verify"
    ]
};

export default module;
