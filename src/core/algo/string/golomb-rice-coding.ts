/**
 * golomb-rice-coding.ts – Golomb-Rice coding.
 *
 * Rice coding is Golomb coding restricted to a power-of-two divisor 2^k. A
 * nonnegative integer is split into a quotient n >> k written in unary and a
 * remainder n mod k written in exactly k bits. Small numbers have small
 * quotients, so runs of data clustered near zero compress well.
 *
 *  Time:  O(total bits) with parameter k
 *  Space: O(total bits emitted)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function encode(n: number, k: number): string {
    const quotient = Math.floor(n / (1 << k));
    const remainder = n % (1 << k);
    return "1".repeat(quotient) + "0" + (k === 0 ? "" : remainder.toString(2).padStart(k, "0"));
}

function decode(bits: string, k: number): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let q = 0;
        while (bits[i] === "1") {
            q += 1;
            i += 1;
        }
        if (bits[i] !== "0") break;
        i += 1;
        const remBits = bits.slice(i, i + k);
        if (remBits.length < k) break;
        out.push(q * (1 << k) + (remBits === "" ? 0 : parseInt(remBits, 2)));
        i += k;
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
    const cfg = (input as { numbers?: number[]; k?: number } | null) ?? {};
    const numbers = Array.isArray(cfg.numbers)
        ? cfg.numbers.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 8)
        : [0, 1, 2, 3, 4, 5, 6, 7];
    if (numbers.length === 0) numbers.push(0);
    const k = typeof cfg.k === "number" && cfg.k >= 0 && cfg.k <= 8 ? Math.floor(cfg.k) : 2;

    const codes = numbers.map((n) => encode(n, k));
    const stream = codes.join("");
    const decoded = decode(stream, k);
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
        meta: { bits, roundTrip, k, count: numbers.length },
    });

    yield F(bitEntities(stream), `Rice stream for [${numbers.join(", ")}] with k=${k} has ${stream.length} bits.`, 0, stream);
    step += 1;
    for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i] as number;
        const q = Math.floor(n / (1 << k));
        const r = n % (1 << k);
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n}: quotient ${q} in unary, remainder ${r} in ${k} bits gives "${codes[i]}".`,
            i + 1,
            codes.slice(0, i + 1).join(""),
        );
        step += 1;
    }
    yield F(
        bitEntities(stream),
        `Counting ones before the zero then reading ${k} remainder bits decodes to [${decoded.join(", ")}] (match: ${roundTrip}).`,
        numbers.length + 1,
        stream,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition: "Golomb-Rice coding splits a number into a quotient and a remainder, where the divisor is a power of two. The quotient is written as a run of ones ending in a zero, and the remainder is written in a fixed number of binary bits. Numbers near zero need very few bits, which suits data with a geometric distribution.",
        invariants: [
            "With divisor 2 to the k, the quotient is n shifted right by k and the remainder is the low k bits.",
            "The unary quotient and fixed-width remainder are jointly prefix-free.",
            "Decoding the emitted stream recovers the original nonnegative integers."
        ],
        correctness: "Reading ones until the first zero yields the quotient exactly, and the following k bits are the remainder. Reconstructing quotient times 2 to the k plus the remainder returns n. Because the quotient is delimited by the zero and the remainder has fixed width, the concatenation of codes has a unique parse, and the module verifies the round trip.",
        complexityRationale: "The code for n uses about n / 2 to the k unary bits plus k remainder bits, so its length is O(n / 2^k + k). With a well chosen k the average length tracks the geometric distribution of the data, and encoding and decoding scan each emitted bit once.",
        uses: [
            "Residual coding in lossless image and audio compression",
            "Encoding run lengths and prediction errors",
            "Rice coding in the FLAC audio format",
            "Compressing geometrically distributed integers"
        ],
        references: [
            "Golomb, Run-Length Encodings, IEEE Transactions on Information Theory, 1966",
            "Rice, Some Practical Universal Noiseless Coding Techniques, 1979"
        ],
        workedExample: "With k = 2 the divisor is 4. The value 6 has quotient 1 and remainder 2, so it is written as one 1, a 0, then remainder 2 in two bits, giving 110. Decoding 110 reads one leading 1 and the zero to get quotient 1, then reads 10 as remainder 2, and computes 1*4 + 2 = 6."
    },
    id: "golomb-rice-coding",
    name: "Golomb-Rice Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [0, 1, 2, 3, 4, 5, 6, 7], k: 2 },
    visualType: "text",
    run,
    pseudocode: [
        "choose the Rice parameter k and divisor two to the k",
        "initialize an empty bit stream",
        "for each nonnegative value n compute quotient n divided by divisor",
        "write the quotient as that many ones then a zero",
        "write the remainder n modulo divisor in k binary bits",
        "decode by counting ones then reading k remainder bits",
        "reconstruct each value and verify against the inputs"
    ]
};

export default module;
