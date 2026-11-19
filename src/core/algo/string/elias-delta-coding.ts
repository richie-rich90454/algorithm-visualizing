/**
 * elias-delta-coding.ts – Elias delta coding.
 *
 * Elias delta encodes a positive integer n by first writing the Elias gamma
 * code of the bit length of n, then the binary digits of n after its leading
 * one. The prefix length is therefore available to the decoder, making the
 * code prefix-free and self-delimiting.
 *
 *  Time:  O(log n) bits per value
 *  Space: O(total bits emitted)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function gamma(n: number): string {
    const b = n.toString(2);
    return "0".repeat(b.length - 1) + b;
}

function encode(n: number): string {
    const b = n.toString(2);
    return gamma(b.length) + b.slice(1);
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
        const lenBits = bits.slice(i, i + z + 1);
        if (lenBits.length < z + 1) break;
        const length = parseInt(lenBits, 2);
        i += z + 1;
        const rest = bits.slice(i, i + Math.max(0, length - 1));
        if (rest.length < length - 1) break;
        out.push(parseInt("1" + rest, 2));
        i += length - 1;
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

    yield F(bitEntities(stream), `Elias delta stream for [${numbers.join(", ")}] has ${stream.length} bits.`, 0, stream);
    step += 1;
    for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i] as number;
        const b = n.toString(2);
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n}: bit length ${b.length} gives gamma "${gamma(b.length)}", then "${b.slice(1)}".`,
            i + 1,
            codes.slice(0, i + 1).join(""),
        );
        step += 1;
    }
    yield F(
        bitEntities(stream),
        `Delta codes are prefix-free; stream decodes back to [${decoded.join(", ")}] (match: ${roundTrip}).`,
        numbers.length + 1,
        stream,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition: "Elias delta codes a positive integer by writing how long its binary representation is, using a short prefix code, and then the remaining binary digits. The length prefix is itself coded with Elias gamma. Smaller numbers get shorter codes, and no code is the prefix of another.",
        invariants: [
            "For a value n with binary length L, the code begins with the gamma code of L followed by exactly L minus one bits.",
            "The concatenated stream is prefix-free, so it has a unique decoding.",
            "Decoding the emitted stream recovers the original number list exactly."
        ],
        correctness: "The gamma prefix uniquely determines L, so the decoder knows precisely how many trailing bits to read. Because the gamma codes are prefix-free and each code has a fixed total length once L is known, the whole delta code is prefix-free and parsing a stream is unambiguous. The module decodes its own output and reports the match.",
        complexityRationale: "An integer n has binary length L = floor(log2 n) + 1; gamma(L) takes 2*floor(log2 L) + 1 bits and the suffix takes L minus one bits, so a code has O(log n) bits. Encoding and decoding a list is linear in the number of emitted bits.",
        uses: [
            "Compressing integer gaps in inverted indexes",
            "Encoding sparse document identifiers in search engines",
            "Prefix codes for slowly growing integer sequences",
            "Lossless compression of positive integer arrays"
        ],
        references: [
            "Elias, Universal Codeword Sets and Representations of the Integers, IEEE Transactions on Information Theory, 1975",
            "Cover and Thomas, Elements of Information Theory, Chapter 5"
        ],
        workedExample: "For 4 the binary form is 100 with length 3. Gamma of 3 is 0011, and the binary digits after the leading one are 00, so the delta code is 001100. For 5 it is 001101. Decoding 0011 announces length 3, so the next two bits 00 reconstruct binary 100, which is 4."
    },
    id: "elias-delta-coding",
    name: "Elias Delta Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each positive value n compute its binary form",
        "let L be the number of binary digits of n",
        "append gamma(L) to the stream",
        "append the binary digits of n after the leading one",
        "decode by reading gamma(L) then L minus one bits",
        "verify the decoded stream equals the input list"
    ]
};

export default module;
