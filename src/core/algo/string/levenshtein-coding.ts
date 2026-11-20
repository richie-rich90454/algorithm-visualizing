/**
 * levenshtein-coding.ts - Levenshtein Universal Code for Integers
 *
 * A Levenshtein code is a universal prefix code for the nonnegative integers:
 * the length of the code for n grows about as n + 2 log(n), matching the
 * information theoretic limit up to lower order terms. The code for n > 0 is
 * a leading one, the recursively encoded binary length minus one, and then the
 * remaining binary digits of n. The code for zero is the single bit zero.
 *
 *  Time:  O(total bits)
 *  Space: O(total bits)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Recursively encode one nonnegative integer. */
function encode(n: number): string {
    if (n === 0) {
        return "0";
    }
    const binary = n.toString(2);
    const magnitude = binary.length - 1;
    return "1" + encode(magnitude) + binary.slice(1);
}

/** Decode one self-delimiting codeword starting at position i. */
function decodeOne(bits: string, position: number): { value: number; next: number } {
    if (bits[position] === "0") {
        return { value: 0, next: position + 1 };
    }
    const magnitude = decodeOne(bits, position + 1);
    const payload = bits.slice(magnitude.next, magnitude.next + magnitude.value);
    const low = payload.length === magnitude.value ? parseInt(payload || "0", 2) : 0;
    return { value: 2 ** magnitude.value + low, next: magnitude.next + magnitude.value };
}

/** Decode a concatenated Levenshtein stream. */
function decode(bits: string): number[] {
    const out: number[] = [];
    let position = 0;
    while (position < bits.length) {
        const word = decodeOne(bits, position);
        out.push(word.value);
        position = word.next;
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
        : [0, 1, 2, 3, 4, 5];
    const values = numbers.length > 0 ? numbers : [0];
    const codes = values.map(encode);
    const stream = codes.join("");
    const decoded = decode(stream);
    const roundTrip = decoded.join(",") === values.join(",");
    const lines = 6;
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

    yield F(bitEntities(""), `Levenshtein codes for [${values.join(", ")}]; a leading one recurses on the binary length.`, 0);
    step += 1;
    for (let i = 0; i < values.length; i += 1) {
        const n = values[i] as number;
        const magnitude = n === 0 ? 0 : n.toString(2).length - 1;
        yield F(
            bitEntities(codes.slice(0, i + 1).join("")),
            `${n} has ${magnitude} payload bit(s); its code is "${codes[i]}" of length ${(codes[i] as string).length}.`,
            1,
        );
        step += 1;
    }
    yield F(bitEntities(stream), `Concatenated stream has ${stream.length} bits.`, 3);
    step += 1;
    yield F(bitEntities(stream), `Recursive decoding recovers [${decoded.join(", ")}] (match: ${roundTrip}).`, 4);
}

const module: AlgorithmModule = {
    education: {
        intuition: "A universal code should use about log(n) bits for the magnitude of n and then enough extra bits to point out where the magnitude ends. Levenshtein coding does this recursively: the leading bit tells whether the value is zero, and for larger values the code first describes the length of the binary expansion using the same code again, then lists the remaining bits. The recursion makes the code self-delimiting and prefix-free.",
        invariants: [
            "The code for zero is the single bit zero; every other code starts with a one.",
            "After the leading one, the next self-delimiting codeword gives the payload length.",
            "No codeword is a prefix of another, so a stream decodes uniquely.",
        ],
        correctness: "For n greater than zero, binary(n) begins with a one followed by m = floor(log2 n) payload bits, and n equals 2^m plus the payload value. The encoding writes a one, then the recursively encoded m, then those m payload bits. Decoding reads the one, recursively parses m, and reads exactly m bits, reconstructing n. The leading one distinguishes nonzero codes from the zero code, and the recursive self-delimiting length means no complete codeword can be the prefix of a longer one, giving unique decoding.",
        complexityRationale: "The length L(n) satisfies L(n) = 1 + L(floor(log2 n)) + floor(log2 n), which solves to n plus a lower-order logarithmic term, matching the optimal universal-code length up to O(log n). Encoding and decoding touch each emitted bit once, so both run in time linear in the bit count.",
        uses: [
            "Universal compression of integer-valued symbols when no probability model is known",
            "A building block in arithmetic and dictionary compression schemes",
            "Self-delimiting integer fields in compact binary formats",
        ],
        references: [
            "Levenshtein, On the Optimal Coding of a Set of Words for a Noiseless Channel, 1968",
            "Cover and Thomas, Elements of Information Theory, Chapter 5 (universal codes)",
        ],
        workedExample: "Zero encodes as 0. One encodes as 1 + code(0) + no payload, which is 10. Two is binary 10 with m = 1, giving 1 + code(1) + 0 = 1100. Three is 1 + code(1) + 1 = 1101. Reading 1101: a one, then code(1) = 10 marks m = 1, then the final bit 1 is the payload, giving 2^1 + 1 = 3.",
    },
    id: "levenshtein-coding",
    name: "Levenshtein Coding",
    category: "string",
    complexity: { time: "O(total bits)", space: "O(total bits)" },
    defaultInput: { numbers: [0, 1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each value n, if n is zero append the bit zero",
        "otherwise let m be the binary length of n minus one",
        "append one, then the recursive Levenshtein code of m, then the low m bits of n",
        "decode recursively by reading the length code then its payload bits",
        "verify that the decoded values match the inputs",
    ],
};

export default module;
