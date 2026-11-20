/**
 * exp-golomb-coding.ts – Exponential Golomb coding (k = 0).
 *
 * The exp-Golomb code of a nonnegative integer n writes the binary form of
 * n+1 preceded by one fewer zero than the length of that binary form. Reading
 * the leading zeros tells the decoder how many following bits to collect;
 * subtracting one recovers n. This is the ue(v) code used in H.264 and H.265.
 *
 *  Time:  O(log n) bits per value
 *  Space: O(total bits emitted)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function encode(n: number): string {
    const b = (n + 1).toString(2);
    return "0".repeat(b.length - 1) + b;
}

function decode(bits: string): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let z = 0;
        while (bits[i] === "0") {
            z += 1;
            i += 1;
        }
        const chunk = bits.slice(i, i + z + 1);
        if (chunk.length < z + 1) break;
        out.push(parseInt(chunk, 2) - 1);
        i += z + 1;
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
        ? cfg.numbers.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 8)
        : [0, 1, 2, 3, 4, 5];
    if (numbers.length === 0) numbers.push(0);

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

    yield F(bitEntities(stream), `Exp-Golomb stream for [${numbers.join(", ")}] has ${stream.length} bits.`, 0, stream);
    step += 1;
    for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i] as number;
        const b = (n + 1).toString(2);
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n}: n+1 is "${b}" of length ${b.length}, so write ${b.length - 1} zeros then the digits.`,
            i + 1,
            codes.slice(0, i + 1).join(""),
        );
        step += 1;
    }
    yield F(
        bitEntities(stream),
        `Reading leading zeros then that many more bits decodes to [${decoded.join(", ")}] (match: ${roundTrip}).`,
        numbers.length + 1,
        stream,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition: "Exponential Golomb coding reserves a run of leading zeros to announce how long the payload is. The payload is the binary form of n+1, so a value of zero becomes the single bit 1. Larger values get longer zero runs, which makes the code compact for small nonnegative integers.",
        invariants: [
            "The code of n is exactly (length of binary(n+1) minus one) zeros followed by binary(n+1).",
            "No valid code is a prefix of another, so a concatenated stream has a unique parse.",
            "Decoding the emitted stream recovers the original nonnegative integers."
        ],
        correctness: "Counting the leading zeros z tells the decoder that the payload is z+1 bits long. Those bits form binary(n+1), and subtracting one gives back n. Since every code begins with its length in unary, no code can be a prefix of a longer one, making the code uniquely decodable. The module verifies the round trip explicitly.",
        complexityRationale: "For a value n the payload has floor(log2(n+1)) + 1 bits, and the unary prefix has one fewer zero, so the total length is about 2*floor(log2(n+1)) + 1 bits, which is O(log n). Encoding and decoding take time linear in the emitted bits.",
        uses: [
            "Exp-Golomb ue(v) fields in H.264 and H.265 video bitstreams",
            "Encoding motion vectors and transform coefficients",
            "Compact representation of nonnegative integer parameters",
            "Prefix codes in modern video codecs"
        ],
        references: [
            "Golomb, Run-Length Encodings, IEEE Transactions on Information Theory, 1966",
            "ITU-T H.264 Recommendation, Annex B (exp-Golomb codes)"
        ],
        workedExample: "For n = 0, n+1 = 1 has one bit, so the code is just 1. For n = 2, n+1 = 11 has two bits, so write one zero then 11 to get 011. Decoding 00100 counts two zeros, reads the next three bits 100, which is 4, and subtracts one to recover 3."
    },
    id: "exp-golomb-coding",
    name: "Exponential Golomb Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [0, 1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each nonnegative value n compute m <- n + 1",
        "let b be the binary form of m and L its length",
        "append L minus one zero bits then b",
        "append the code to the growing stream",
        "decode by counting zeros then reading that many more bits",
        "subtract one from each payload and verify the inputs"
    ]
};

export default module;
