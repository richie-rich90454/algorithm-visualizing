/**
 * unary-coding.ts - Unary Coding
 *
 * A nonnegative integer n is encoded as n one bits followed by a single
 * terminating zero bit. The code for zero is therefore just "0". Unary coding
 * is the simplest prefix code and appears as the leading run in Golomb, Elias,
 * and Levenshtein codes. Decoding counts ones until the first zero.
 *
 *  Time:  O(total bits)
 *  Space: O(total bits)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Encode one nonnegative integer as ones followed by a terminating zero. */
function encode(n: number): string {
    return "1".repeat(n) + "0";
}

/** Decode a concatenated unary stream back into integers. */
function decode(bits: string): number[] {
    const out: number[] = [];
    let count = 0;
    for (const bit of bits) {
        if (bit === "1") {
            count += 1;
        } else {
            out.push(count);
            count = 0;
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
    return [...bits].map((bit, index) => ({
        id: `bit-${index}`,
        type: "character" as const,
        label: bit,
        value: bit,
        state: "sorted" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bit },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { numbers?: number[] } | null) ?? {};
    const numbers = Array.isArray(cfg.numbers)
        ? cfg.numbers.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 16)
        : [0, 1, 2, 3, 4];
    const values = numbers.length > 0 ? numbers : [0];
    const codes = values.map(encode);
    const stream = codes.join("");
    const decoded = decode(stream);
    const roundTrip = decoded.join(",") === values.join(",");
    const lines = 5;
    let step = 0;
    const F = (entities: VisualEntity[], description: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { bits: stream, roundTrip, count: values.length },
    });

    yield F(bitEntities(""), `Unary coding of [${values.join(", ")}]: each value is ones followed by a zero.`, 0);
    step += 1;
    for (let i = 0; i < values.length; i += 1) {
        const n = values[i] as number;
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `Value ${n} encodes as ${n} one bit(s) then a zero, giving "${codes[i]}".`,
            1,
        );
        step += 1;
    }
    yield F(bitEntities(stream), `Concatenated stream has ${stream.length} bits.`, 2);
    step += 1;
    yield F(bitEntities(stream), `Counting ones until each zero decodes to [${decoded.join(", ")}] (match: ${roundTrip}).`, 3);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Unary coding writes a value n as a run of n ones closed by a single zero. It is the most direct way to make a self-delimiting code: the terminating zero tells the decoder where one number ends and the next begins. Small values are extremely cheap, which is why unary prefixes appear inside many more general universal codes.",
        invariants: [
            "The code of n has exactly n + 1 bits.",
            "No code is a prefix of another because every code ends with its only zero.",
            "Decoding the concatenated stream recovers the original integers in order.",
        ],
        correctness: "A unary code contains exactly one zero, at the end, so reading until the first zero consumes precisely one codeword and yields its count of ones as the value. Because every valid codeword ends at its first zero, no longer codeword can start with a complete shorter one, so the set is prefix-free and any concatenation has a unique parse.",
        complexityRationale: "Encoding n writes n + 1 bits, so the total work and emitted length are both the sum of (n + 1) over the inputs, which is the total number of bits. Decoding scans each bit once, giving linear time and linear output space.",
        uses: [
            "The leading run in Golomb and Rice codes for quotient values",
            "Part of Elias and Levenshtein universal integer codes",
            "Simple run-length and unary bitstream fields",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3 (unary and prefix codes)",
            "Cover and Thomas, Elements of Information Theory, Chapter 5 (prefix codes)",
        ],
        workedExample: "The value 0 encodes as 0, 1 as 10, 2 as 110, and 5 as 111110. The concatenation for [0, 1, 2] is 0110110, which decodes by reading 0, then 10, then 110, recovering 0, 1, 2.",
    },
    id: "unary-coding",
    name: "Unary Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [0, 1, 2, 3, 4] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each nonnegative value n append n one bits",
        "append a single terminating zero bit",
        "decode by counting ones until each zero then emit the count",
        "verify that the decoded values match the inputs",
    ],
};

export default module;
