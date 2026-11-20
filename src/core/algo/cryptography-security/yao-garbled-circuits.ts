/**
 * yao-garbled-circuits.ts - Garbled Circuit for an AND Gate (Toy Labels)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In Yao's garbled-circuit protocol one party garbles a boolean circuit by
 * replacing every wire bit with a random label. For each gate the generator
 * encrypts the output label under the pair of input labels and places the
 * ciphertext at a row determined by the labels' color bits. An evaluator who
 * holds the two input labels can open exactly one row, recover the output
 * label, and decode it to a bit without learning the other rows. This module
 * garbles one AND gate with sixteen-bit labels and a toy hash, so the whole
 * table is checkable. It is a teaching model, not a secure implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(1) per gate for garbling and evaluation
 *   Space: O(1) garbled rows and labels per gate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the four garbled rows and the selected row value.
 *   - meta reports the input bits, selected row, and decoded output bit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = 0xffff;

export interface Label {
    value: number;
    color: number;
}

/** Toy keyed hash combining two labels into a 16-bit mask. */
export function hashLabels(first: number, second: number): number {
    let h = (first ^ Math.imul(second, 0x9e37)) & MASK;
    h = Math.imul(h ^ (h >>> 7), 0x85eb) & MASK;
    return (h ^ (h >>> 13)) & MASK;
}

/** Deterministic label generator from a seed and a small index. */
function labelFrom(seed: number, index: number): Label {
    const base = Math.imul(seed + 1, 0x9e37) & 0x7fff;
    const value = ((base + Math.imul(index + 1, 0x4b1d)) & 0x7fff) << 1;
    const color = (index & 1) ^ (seed & 1);
    return { value, color };
}

export interface GarbledGate {
    rows: number[];
    inputA: [Label, Label];
    inputB: [Label, Label];
    output: [Label, Label];
}

/** Garble a two-input AND gate. */
export function garble(seed: number): GarbledGate {
    const inputA: [Label, Label] = [labelFrom(seed, 0), labelFrom(seed, 1)];
    const inputB: [Label, Label] = [labelFrom(seed, 2), labelFrom(seed, 3)];
    const output: [Label, Label] = [labelFrom(seed, 4), labelFrom(seed, 5)];
    const rows = new Array<number>(4).fill(0);
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            const la = a === 0 ? inputA[0]! : inputA[1]!;
            const lb = b === 0 ? inputB[0]! : inputB[1]!;
            const out = (a & b) === 0 ? output[0]! : output[1]!;
            const row = la.color * 2 + lb.color;
            rows[row] = (hashLabels(la.value, lb.value) ^ out.value) & MASK;
        }
    }
    return { rows, inputA, inputB, output };
}

/** Evaluate the garbled gate on two labels, returning the decoded bit. */
export function evaluate(gate: GarbledGate, labelA: Label, labelB: Label): number {
    const row = labelA.color * 2 + labelB.color;
    const label = (gate.rows[row]! ^ hashLabels(labelA.value, labelB.value)) & MASK;
    if (label === gate.output[0]!.value) {
        return 0;
    }
    if (label === gate.output[1]!.value) {
        return 1;
    }
    return -1;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: value.toString(16),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: "garbled row" },
    }));
}

/** The garbled-circuit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; firstBit?: number; secondBit?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 4;
    const firstBit = typeof task.firstBit === "number" ? (task.firstBit ? 1 : 0) : 1;
    const secondBit = typeof task.secondBit === "number" ? (task.secondBit ? 1 : 0) : 1;
    const gate = garble(seed);
    const labelA = firstBit === 0 ? gate.inputA[0]! : gate.inputA[1]!;
    const labelB = secondBit === 0 ? gate.inputB[0]! : gate.inputB[1]!;
    const row = labelA.color * 2 + labelB.color;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(gate.rows, -1),
        edges: [],
        description: `Yao garbled AND gate: four ciphertext rows indexed by the color bits of the input labels.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, firstBit, secondBit, row: 0, output: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(gate.rows, row),
        edges: [],
        description: `Input bits ${firstBit} and ${secondBit} select garbled row ${row} via the label colors.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { seed, firstBit, secondBit, row, output: -1 },
    };
    step += 1;

    const output = evaluate(gate, labelA, labelB);
    yield {
        stepNumber: step,
        entities: makeBars([gate.rows[row]!, hashLabels(labelA.value, labelB.value), labelA.value, labelB.value], 0),
        edges: [],
        description: `Xor row ${row} with the hash of the two labels to recover the output label.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { seed, firstBit, secondBit, row, output: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([output, firstBit & secondBit, gate.output[0]!.value, gate.output[1]!.value], 0),
        edges: [],
        description: `Decoded output ${output}, expected AND value ${firstBit & secondBit}. Toy labels, not a secure protocol.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { seed, firstBit, secondBit, row, output, expected: firstBit & secondBit },
    };
}

/** The garbled-circuit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Garbled circuits let two parties compute a function without either seeing the other's input in the clear. One party replaces each wire value with a random label and encrypts each gate's output label under its two input labels. The other party learns only the labels for its inputs and the garbled table, so it can open one row per gate and learn nothing about the rows it cannot decrypt. Color bits hide which row is which from the evaluator.",
        invariants: [
            "Each wire has two labels, one per semantic bit, each with a color bit.",
            "The four garbled rows are indexed by the two input labels' color bits.",
            "Only the row matching the evaluator's labels decrypts to a valid output label.",
        ],
        correctness:
            "For every pair of input bits and many garbling seeds, evaluation of the garbled table returns exactly the AND truth-table value, and no other row decrypts to a valid output label. A changed input label or a corrupted row fails to decode. These checks verify the garbling and evaluation algebra; sixteen-bit labels and a toy hash provide no real security, and oblivious transfer is simulated rather than implemented.",
        complexityRationale:
            "Garbling encrypts one row per input combination and evaluation decrypts exactly one, so both are constant time for a fixed fan-in gate. Space is one label per wire and one ciphertext per row.",
        uses: [
            "Secure two-party computation of arbitrary boolean functions",
            "Private function evaluation without a trusted party",
            "Teaching the foundation of modern garbled-circuit compilers",
        ],
        references: [
            "Yao, How to Generate and Exchange Secrets, 1986",
            "Kolesnikov and Schneider, Improved Garbled Circuit: Free XOR Gates, 2008",
        ],
        workedExample:
            "For inputs 1 and 1 the labels' color bits select one of four rows. Xoring that row with the hash of the two labels recovers the label representing output bit one, which the decoding table maps back to 1, the AND of the inputs. Rows for the other input pairs decrypt to values that are not valid output labels.",
    },
    id: "yao-garbled-circuits",
    name: "Yao Garbled Circuit for AND (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { seed: 4, firstBit: 1, secondBit: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "choose two random labels per wire with a color bit each",
        "for every input pair encrypt the output label under the input labels",
        "store each ciphertext at the row given by the color bits",
        "the evaluator obtains labels for its input bits",
        "select the row indexed by those labels' colors",
        "xor the row with the hash of the two labels",
        "decode the recovered output label to a bit",
        "done: report the garbled gate output",
    ],
};

export default module;
