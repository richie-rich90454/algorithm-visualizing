/**
 * elias-omega-coding.ts – Elias omega coding.
 *
 * Omega coding recursively encodes the length of a number's binary form. A
 * value of one is a single 1 bit. Otherwise write 0, then the omega code of
 * the number of bits after the leading one, then those remaining bits. The
 * recursion strictly decreases the argument, so it terminates.
 *
 *  Time:  O(log* n + log n) bits per value
 *  Space: O(total bits emitted)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function encode(n: number): string {
    const b = n.toString(2);
    const rest = b.slice(1);
    if (rest.length === 0) return "1";
    return "0" + encode(rest.length) + rest;
}

function decodeBits(bits: string, pos: { i: number }): number {
    if (bits[pos.i] === "1") {
        pos.i += 1;
        return 1;
    }
    pos.i += 1;
    const length = decodeBits(bits, pos);
    const rest = bits.slice(pos.i, pos.i + length);
    pos.i += length;
    return parseInt("1" + rest, 2);
}

function decode(bits: string): number[] {
    const out: number[] = [];
    const pos = { i: 0 };
    while (pos.i < bits.length) {
        out.push(decodeBits(bits, pos));
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
        : [1, 2, 3, 4, 5];
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

    yield F(bitEntities(stream), `Elias omega stream for [${numbers.join(", ")}] has ${stream.length} bits.`, 0, stream);
    step += 1;
    for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i] as number;
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n} encodes as "${codes[i]}" by recursing on the bit count ${Math.floor(Math.log2(n))}.`,
            i + 1,
            codes.slice(0, i + 1).join(""),
        );
        step += 1;
    }
    yield F(
        bitEntities(stream),
        `Omega is prefix-free; the stream decodes back to [${decoded.join(", ")}] (match: ${roundTrip}).`,
        numbers.length + 1,
        stream,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition: "Elias omega coding encodes the length of a number's binary representation and then recurses on that length. The recursion shrinks quickly because the length of a binary string is far smaller than the number it represents, so only a few nested prefixes are needed.",
        invariants: [
            "The code for one is the single bit 1, and every larger code starts with 0 followed by the code of its remaining bit count.",
            "Each recursive call receives a strictly smaller positive integer, so encoding terminates.",
            "The concatenated stream is prefix-free and decodes back to the original values."
        ],
        correctness: "A leading 1 marks the base case of value one; a leading 0 tells the decoder to first read a nested omega code giving the number of trailing bits, then read exactly that many bits and prepend a leading one. Because the nested length is always smaller, recursion terminates and the prefix-free property makes decoding unique. The module verifies the round trip.",
        complexityRationale: "The nested lengths shrink as the iterated logarithm log* of n, so the prefix costs O(log* n) bits and the final binary suffix costs O(log n) bits. Encoding and decoding take time proportional to the emitted bit length.",
        uses: [
            "Universal coding when the integer distribution is unknown",
            "Compressing integers with very heavy tails",
            "Encoding document frequencies in information retrieval",
            "Building blocks for more compact universal codes"
        ],
        references: [
            "Elias, Universal Codeword Sets and Representations of the Integers, IEEE Transactions on Information Theory, 1975",
            "Cover and Thomas, Elements of Information Theory, Chapter 5"
        ],
        workedExample: "The value 1 is coded as 1. The value 2 has binary 10, so it writes 0, then the omega code of the remaining length 1 which is 1, then the remaining bit 0, giving 010. The value 4 has binary 100 with two remaining bits, giving 0 plus omega(2) which is 010 plus 00, so 001000."
    },
    id: "elias-omega-coding",
    name: "Elias Omega Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each positive value n encode recursively",
        "if n has no bits after its leading one append 1",
        "otherwise append 0 then encode the remaining bit count",
        "append the binary digits after the leading one",
        "decode by reading the nested length then its bits",
        "verify the decoded stream equals the input list"
    ]
};

export default module;
