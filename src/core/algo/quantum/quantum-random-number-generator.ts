/**
 * quantum-random-number-generator.ts - Measurement-Based Quantum Random Bits
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A quantum random number generator prepares a qubit in an equal superposition
 * with a Hadamard-like rotation, then measures it in the computational basis.
 * The Born rule gives each outcome probability one half, so the measurement
 * result is a genuinely unpredictable bit. Repeating the prepare-and-measure
 * cycle builds a random string that can be read as an integer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b) for b generated bits
 *   Space: O(b) for the output string
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the amplitudes of |0> and |1> before measurement.
 *   - After measurement one bar collapses to 1 and the other to 0.
 *   - Frame metadata carries the rotation angle, the Born probabilities, the
 *     sampled outcome, and the bits accumulated so far.
 *
 * This is an exact small simulation limited to one qubit at a time. Real
 * hardware supplies true randomness from the measurement device; to make this
 * replayable visualization deterministic, a seeded classical generator stands
 * in for the physical measurement. The quantum state math and the sampling
 * rule are exact, but the seed is not a source of entropy.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(amplitude0: number, amplitude1: number, measured: number | null): VisualEntity[] {
    const amplitudes = [amplitude0, amplitude1];
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `|${index}> p=${(amplitude * amplitude).toFixed(3)}`,
        value: amplitude * amplitude,
        state: measured === null ? "comparing" : index === measured ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { basis: index, amplitude, probability: amplitude * amplitude },
    }));
}

/** The quantum random number generator simulator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number; seed?: number; angle?: number } | null) ?? {};
    const bitCount = Math.max(1, Math.min(32, Math.floor(task.bits ?? 8)));
    const angle = typeof task.angle === "number" && Number.isFinite(task.angle) ? task.angle : Math.PI / 4;
    let seed = (typeof task.seed === "number" ? task.seed : 12345) >>> 0;
    const nextUniform = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const amplitude0 = Math.cos(angle);
    const amplitude1 = Math.sin(angle);
    const prob0 = amplitude0 * amplitude0;
    const bits: number[] = [];
    let step = 0;

    const emit = (description: string, codeLine: number, a0: number, a1: number, measured: number | null, extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(a0, a1, measured),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {
                angle,
                prob0,
                prob1: 1 - prob0,
                measured: measured ?? -1,
                bits: [...bits],
                bitCount,
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    for (let i = 0; i < bitCount; i += 1) {
        yield emit(`Bit ${i + 1}: reset the qubit to |0> and rotate by ${angle.toFixed(3)} radians.`, 1, 1, 0, null, {
            bitIndex: i,
        });
        yield emit(`The qubit is now cos(angle)|0> + sin(angle)|1>, with P(0)=${prob0.toFixed(3)}.`, 2, amplitude0, amplitude1, null, {
            bitIndex: i,
        });
        const outcome = nextUniform() < prob0 ? 0 : 1;
        bits.push(outcome);
        yield emit(`Measurement collapsed the qubit to |${outcome}> and appended bit ${outcome}.`, 3, outcome === 0 ? 1 : 0, outcome === 1 ? 1 : 0, outcome, {
            bitIndex: i,
        });
    }

    const value = bits.reduce((acc, bit) => acc * 2 + bit, 0);
    yield emit(`Collected ${bitCount} random bits: ${bits.join("")}, which is ${value} in binary.`, 5, 1, 0, null, {
        done: true,
        value,
        bitString: bits.join(""),
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Preparing a qubit halfway between zero and one and then measuring it gives a zero or a one with equal probability. There is no hidden bit being read out; the outcome is created by the measurement itself. Repeating this prepare-and-measure loop produces one unpredictable bit per round, and a run of those bits is a random binary number.",
        invariants: [
            "Before measurement the squared amplitudes are cos squared and sin squared of the angle.",
            "Exactly one basis state has amplitude one after measurement.",
            "The recorded bits are the measured outcomes in generation order.",
        ],
        correctness:
            "The rotation prepares the state cos(theta)|0> plus sin(theta)|1>, so the Born rule assigns probabilities cos squared theta and sin squared theta. Sampling a uniform value against the first probability reproduces that distribution exactly, and the subsequent collapse sets the measured basis amplitude to one and the other to zero, keeping the state normalized. With theta equal to pi over four both outcomes have probability one half, giving unbiased bits.",
        complexityRationale:
            "Each round performs one rotation, one sample, and one collapse, all constant time, so b rounds take O(b) time. Storing the b output bits uses O(b) space.",
        uses: [
            "Hardware random number generators based on quantum measurement",
            "Seeding cryptographic keys from physical entropy sources",
            "Lotteries and simulations that need nondeterministic bits",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
            "ID Quantique, Quantum Random Number Generation white paper, 2024",
        ],
        workedExample:
            "With the default angle of pi over four, the prepared state has amplitudes 0.7071 and 0.7071, so P(0) and P(1) are both 0.5. A measured zero collapses to |0> and records bit 0; repeating eight times yields an eight-bit string read as an integer between 0 and 255.",
    },
    id: "quantum-random-number-generator",
    name: "Quantum Random Number Generator",
    category: "quantum",
    complexity: { time: "O(b)", space: "O(b)" },
    defaultInput: { bits: 8, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the number of bits and the rotation angle",
        "reset one qubit to the zero state",
        "rotate the qubit into cos(angle) zero plus sin(angle) one",
        "sample an outcome with probability equal to the squared amplitude",
        "collapse the state to the measured basis state",
        "append the outcome to the random bit string",
        "repeat until the requested number of bits is collected",
        "done: interpret the bit string as a random integer",
    ],
};

export default module;
