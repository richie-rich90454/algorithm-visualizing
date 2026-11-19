/**
 * modular-exponentiation.ts - Right-to-Left Modular Exponentiation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Computes base^exponent modulo modulus by scanning the bits of the exponent
 * from least significant to most significant. A running result is multiplied
 * by the current power only when the bit is set, and the power is squared at
 * every step. Reducing after each multiplication keeps every value smaller
 * than the modulus, so the computation never forms the enormous integer
 * base^exponent. This is the square-and-multiply routine used by RSA and
 * Diffie-Hellman; it is distinct from plain binary exponentiation, which does
 * no modular reduction and returns the full power.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log exponent) multiplications
 *   Space: O(log exponent) for the displayed bit row
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Exponent bits are grid cells in row 0; the current bit is ACTIVE.
 *   - Result, base power, and remaining exponent are register cells in row 1.
 *   - The final frame reports the residue in meta.result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** One grid cell. */
function cell(
    row: number,
    col: number,
    label: string,
    value: number | string,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${row}-${col}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { base?: number; exponent?: number; modulus?: number } | null) ?? {};
    const base = typeof task.base === "number" ? Math.trunc(task.base) : 2;
    const exponent = typeof task.exponent === "number" ? Math.trunc(task.exponent) : 10;
    const modulus = typeof task.modulus === "number" ? Math.trunc(task.modulus) : 1000;
    const m = modulus > 1 ? modulus : 1000;
    const exp = exponent >= 0 ? exponent : 0;
    const bits = exp.toString(2).split("").reverse();

    let result = 1 % m;
    let power = ((base % m) + m) % m;
    let remaining = exp;
    let step = 0;

    const registers = (bitIndex: number): VisualEntity[] => [
        cell(1, 0, `result=${result}`, result, result === 1 % m ? "idle" : "sorted"),
        cell(1, 1, `power=${power}`, power, "comparing"),
        cell(1, 2, `exp=${remaining}`, remaining, "active"),
    ];

    const bitCells = (active: number): VisualEntity[] =>
        bits.map((bit, i) =>
            cell(0, i, bit, Number(bit), i < active ? "sorted" : i === active ? "active" : "idle"),
        );

    yield {
        stepNumber: step,
        entities: [...bitCells(-1), ...registers(-1)],
        edges: [],
        description: `Compute ${base}^${exp} modulo ${m} by scanning ${bits.length} exponent bit(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { base, exponent: exp, modulus: m, result, bitIndex: -1, bits: bits.join("") },
    };
    step += 1;

    let bitIndex = 0;
    while (remaining > 0 && bitIndex < bits.length) {
        const bit = bits[bitIndex] === "1";
        if (bit) {
            result = (result * power) % m;
        }
        const beforeSquare = power;
        power = (power * power) % m;
        remaining = Math.trunc(remaining / 2);
        yield {
            stepNumber: step,
            entities: [...bitCells(bitIndex), ...registers(bitIndex)],
            edges: [],
            description: `Bit ${bitIndex} is ${bits[bitIndex]}${bit ? `, so multiply result by ${beforeSquare} modulo ${m}` : ", so skip the multiplication"}; then square the power and shift the exponent.`,
            codeLineNumber: bit ? 2 : 3,
            layout: "grid",
            meta: {
                base,
                exponent: exp,
                modulus: m,
                result,
                power,
                bitIndex,
                remaining,
                bits: bits.join(""),
            },
        };
        step += 1;
        bitIndex += 1;
    }

    yield {
        stepNumber: step,
        entities: [...bitCells(bits.length), ...registers(bits.length)],
        edges: [],
        description: `Done: ${base}^${exp} modulo ${m} = ${result}, using ${bitIndex} bit step(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { base, exponent: exp, modulus: m, result, bitIndex: bits.length, bits: bits.join("") },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Writing the exponent in binary turns exponentiation into a short walk over its bits. Each bit position corresponds to a power that was repeatedly squared, so you only multiply the answer by the powers whose bit is set. Taking the remainder after every operation stops the numbers from growing without changing the final residue.",
        invariants: [
            "After processing bit i, the result equals base raised to the exponent formed by the bits already seen, modulo m.",
            "The power register always holds base raised to 2^i modulo m.",
            "Every stored value stays strictly between 0 and m-1.",
        ],
        correctness:
            "The exponent is the sum of base raised to i for every set bit i. Maintaining base^(2^i) in the power register and squaring it each step makes that term available exactly when bit i is read. Multiplying the result by it accumulates precisely the set-bit terms, so the product is base^exponent. Modular multiplication is a ring homomorphism, so reducing after each step yields base^exponent modulo m without ever changing the residue.",
        complexityRationale:
            "The loop runs once per bit of the exponent, that is O(log exponent) times, with a constant number of multiplications per bit. The bit row used for the visualization holds O(log exponent) cells, while the arithmetic itself needs only a few registers, so auxiliary space is O(log exponent) here and O(1) without the display.",
        uses: [
            "RSA encryption, decryption, and signature verification",
            "Diffie-Hellman key exchange and elliptic curve scalar multiplication subroutines",
            "Fermat and Miller-Rabin primality tests that evaluate a^((n-1)) modulo n",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.6.4",
            "CLRS, Introduction to Algorithms, Chapter 31",
        ],
        workedExample:
            "For 2^10 modulo 1000 the exponent bits are 0, 1, 0, 1 from least to most significant. The set bits at positions 1 and 3 contribute powers 4 and 256, whose product is 1024. Reducing modulo 1000 gives 24, so the routine reports 24 after four bit steps.",
    },
    id: "modular-exponentiation",
    name: "Modular Exponentiation",
    category: "math",
    complexity: { time: "O(log exponent)", space: "O(log exponent)" },
    defaultInput: { base: 2, exponent: 10, modulus: 1000 },
    visualType: "grid",
    run,
    pseudocode: [
        "set result to 1 modulo m and power to base modulo m",
        "while the exponent is positive",
        "if the current exponent bit is one, multiply result by power modulo m",
        "otherwise leave result unchanged and square the power modulo m",
        "halve the exponent and advance to the next bit",
        "done: report the residue result",
    ],
};

export default module;
