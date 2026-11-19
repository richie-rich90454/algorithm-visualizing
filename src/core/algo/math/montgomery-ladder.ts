/**
 * montgomery-ladder.ts - Montgomery Ladder for Modular Exponentiation
 *
 * Computes base^exponent modulo modulus with a fixed sequence of one
 * multiplication and one squaring per exponent bit. Both accumulators are
 * updated every iteration regardless of the secret bit, which avoids the
 * timing leaks of the square-and-multiply algorithm.
 *
 *   Time:  O(log exponent) modular multiplications
 *   Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LadderInput {
    base?: number;
    exponent?: number;
    modulus?: number;
}

function makeEntities(r0: bigint, r1: bigint, bitIndex: number, bit: number): VisualEntity[] {
    return [
        {
            id: "acc-0",
            type: "bar" as const,
            label: r0.toString(),
            value: Number(r0),
            state: (bit === 0 ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "R0", value: Number(r0) },
        },
        {
            id: "acc-1",
            type: "bar" as const,
            label: r1.toString(),
            value: Number(r1),
            state: (bit === 1 ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "R1", value: Number(r1) },
        },
        {
            id: "bit",
            type: "bar" as const,
            label: bit === 0 ? "0" : "1",
            value: bit,
            state: "comparing" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "bit", index: bitIndex, value: bit },
        },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LadderInput | null) ?? {};
    const modulus = typeof task.modulus === "number" && Number.isFinite(task.modulus) && task.modulus > 1
        ? Math.trunc(task.modulus)
        : 1000000007;
    const base = typeof task.base === "number" && Number.isFinite(task.base)
        ? ((Math.trunc(task.base) % modulus) + modulus) % modulus
        : 3;
    const exponent = typeof task.exponent === "number" && Number.isFinite(task.exponent) && task.exponent >= 0
        ? Math.trunc(task.exponent)
        : 13;
    const m = BigInt(modulus);
    const bits = exponent.toString(2);
    let r0 = 1n;
    let r1 = BigInt(base) % m;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(r0, r1, -1, -1),
        edges: [],
        description: `Compute ${base}^${exponent} mod ${modulus} with a ${bits.length}-bit Montgomery ladder.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: 3, base, exponent, modulus, bits, steps: 0, result: Number(r0 % m) },
    };
    step += 1;

    for (let i = 0; i < bits.length; i += 1) {
        const bit = bits[i] === "1" ? 1 : 0;
        if (bit === 0) {
            r1 = (r0 * r1) % m;
            r0 = (r0 * r0) % m;
        } else {
            r0 = (r0 * r1) % m;
            r1 = (r1 * r1) % m;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(r0, r1, i, bit),
            edges: [],
            description: `Bit ${i} is ${bit}: R0 = ${r0}, R1 = ${r1} modulo ${modulus}.`,
            codeLineNumber: bit === 0 ? 2 : 3,
            layout: "array",
            meta: { rows: 1, cols: 3, base, exponent, modulus, bitIndex: i, bit, r0: Number(r0), r1: Number(r1), steps: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(r0, r1, bits.length - 1, bits.length - 1 >= 0 ? bits[bits.length - 1] === "1" ? 1 : 0 : 0),
        edges: [],
        description: `Done: ${base}^${exponent} mod ${modulus} = ${r0}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows: 1, cols: 3, base, exponent, modulus, result: Number(r0), steps: bits.length },
    };
}

const module: AlgorithmModule = {
    id: "montgomery-ladder",
    name: "Montgomery Ladder",
    category: "math",
    complexity: { time: "O(log exponent)", space: "O(1)" },
    defaultInput: { base: 3, exponent: 13, modulus: 1000000007 },
    visualType: "array",
    run,
    pseudocode: [
        "set R0 = 1 and R1 = base modulo modulus",
        "write the exponent in binary with its leading one",
        "for each remaining bit from most to least significant",
        "if the bit is zero update R1 = R0*R1 and R0 = R0*R0",
        "if the bit is one update R0 = R0*R1 and R1 = R1*R1",
        "reduce both products modulo the modulus",
        "done: report R0 as base raised to the exponent",
    ],
    education: {
        intuition:
            "Exponentiation by squaring skips work depending on whether a secret bit is zero or one, which can leak information through timing. The Montgomery ladder performs the same two operations at every bit, only swapping which accumulator receives the multiplication and which receives the squaring. The invariant R1 equals R0 times base to the power of the processed prefix keeps both values useful.",
        invariants: [
            "At every step R1 equals R0 times base^(processed prefix) modulo the modulus.",
            "Both accumulators are always reduced into the range [0, modulus).",
            "Exactly one multiplication and one squaring occur per exponent bit.",
        ],
        correctness:
            "Appending a zero bit doubles the prefix exponent, which is achieved by squaring R0 and multiplying R1 by the old R0; appending a one bit maps prefix p to 2p+1, achieved by multiplying R0 by R1 and squaring R1. These updates preserve the invariant by induction from the leading bit, and the initial pair satisfies it, so after all bits R0 is base raised to the full exponent modulo the modulus.",
        complexityRationale:
            "The loop runs once per bit of the exponent, so the time is O(log exponent) modular multiplications. Only the two accumulators and the current bit are stored, giving O(1) space.",
        uses: [
            "Constant-time exponentiation in elliptic-curve cryptography",
            "Modular powering in RSA and Diffie-Hellman implementations",
            "Side-channel resistant arithmetic in smart cards",
        ],
        references: [
            "Montgomery, Speeding the Pollard and Elliptic Curve Methods, 1987",
            "Wikipedia, Montgomery ladder",
        ],
        workedExample:
            "For 3^13 modulo 17, the binary exponent is 1101. Starting with R0 = 1 and R1 = 3, processing bits 1, 0, 1 yields intermediate pairs that maintain R1 = R0 times 3 to the processed prefix, and the final R0 is 12, which equals 3^13 modulo 17.",
    },
};

export default module;
