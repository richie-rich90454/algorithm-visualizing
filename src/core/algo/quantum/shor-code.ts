/**
 * shor-code.ts - Shor Nine-Qubit Error-Correcting Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Shor code encodes one logical qubit into nine physical qubits by nesting
 * a three-qubit bit-flip repetition code inside a three-qubit phase-flip
 * repetition code. Within each block of three, the parity checks Z1Z2 and Z2Z3
 * locate a single bit flip. Across the three blocks, the checks X1..X6 and
 * X4..X9 locate a single phase flip. A decoder reads these syndromes, applies
 * the corresponding X or Z correction, and restores the logical state.
 *
 * This is an exact small simulation of the syndrome-to-correction logic for a
 * single X or Z error on a logical basis state. It is a teaching model: it does
 * not cover Y errors, multiple simultaneous errors, noisy measurements, or the
 * full continuous state vector of the encoded qubit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for one error's syndrome and correction (constant nine qubits)
 *   Space: O(1) for the syndrome bits and correction description
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nine physical qubits are nodes arranged in three blocks of three.
 *   - A red node marks the injected error; syndrome nodes show measured bits.
 *   - The corrected qubit turns green in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    logical?: number;
    errorQubit?: number;
    errorType?: "X" | "Z";
}

/** Locate a single bit flip in a block from its two parity checks. */
function locateBitFlip(s1: number, s2: number): number {
    if (s1 === 1 && s2 === 0) return 0;
    if (s1 === 1 && s2 === 1) return 1;
    if (s1 === 0 && s2 === 1) return 2;
    return -1;
}
/** Locate a single phase-flip block from its two block-comparison checks. */
function locatePhaseFlip(t1: number, t2: number): number {
    if (t1 === 1 && t2 === 0) return 0;
    if (t1 === 1 && t2 === 1) return 1;
    if (t1 === 0 && t2 === 1) return 2;
    return -1;
}

/** Build qubit and syndrome-check nodes for one frame. */
function makeEntities(
    errorQubit: number,
    errorType: string,
    phase: "idle" | "error" | "syndrome" | "done",
    bitChecks: number[],
    phaseChecks: number[],
    corrected: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let q = 0; q < 9; q += 1) {
        let state: EntityState = "idle";
        if (phase === "error") state = q === errorQubit ? "error" : "idle";
        else if (phase === "done") state = corrected && q === errorQubit ? "sorted" : "idle";
        entities.push({
            id: `q-${q}`,
            type: "node",
            label: `q${q}`,
            value: q,
            state,
            x: q % 3,
            y: Math.floor(q / 3) * 2,
            width: 0,
            height: 0,
            metadata: { index: q, block: Math.floor(q / 3), kind: "qubit", error: phase === "error" && q === errorQubit ? errorType : "" },
        });
    }
    for (let b = 0; b < 3; b += 1) {
        const s1 = bitChecks[2 * b] ?? 0;
        const s2 = bitChecks[2 * b + 1] ?? 0;
        entities.push({
            id: `zcheck-${b}`,
            type: "node",
            label: `B${b}:${s1}${s2}`,
            value: s1 * 2 + s2,
            state: phase === "syndrome" && (s1 || s2) ? "error" : "idle",
            x: 0.5,
            y: Math.floor(b / 3) * 2 + 1,
            width: 0,
            height: 0,
            metadata: { index: b, kind: "bitcheck", s1, s2 },
        });
    }
    const t1 = phaseChecks[0] ?? 0;
    const t2 = phaseChecks[1] ?? 0;
    entities.push({
        id: "xcheck",
        type: "node",
        label: `P:${t1}${t2}`,
        value: t1 * 2 + t2,
        state: phase === "syndrome" && (t1 || t2) ? "error" : "idle",
        x: 1.5,
        y: 5,
        width: 0,
        height: 0,
        metadata: { index: 0, kind: "phasecheck", t1, t2 },
    });
    return entities;
}

/** The Shor code generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const logical = task.logical === 1 ? 1 : 0;
    const errorQubit = Math.max(0, Math.min(8, Math.floor(Number(task.errorQubit ?? 1)) || 0));
    const errorType: "X" | "Z" = task.errorType === "Z" ? "Z" : "X";
    const block = Math.floor(errorQubit / 3);
    const posInBlock = errorQubit % 3;

    const bitChecks = [0, 0, 0, 0, 0, 0];
    const phaseChecks = [0, 0];
    if (errorType === "X") {
        bitChecks[2 * block] = posInBlock === 0 || posInBlock === 1 ? 1 : 0;
        bitChecks[2 * block + 1] = posInBlock === 1 || posInBlock === 2 ? 1 : 0;
    } else {
        phaseChecks[0] = block === 0 || block === 1 ? 1 : 0;
        phaseChecks[1] = block === 1 || block === 2 ? 1 : 0;
    }

    const bitPos = locateBitFlip(bitChecks[2 * block] ?? 0, bitChecks[2 * block + 1] ?? 0);
    const phaseBlock = locatePhaseFlip(phaseChecks[0] ?? 0, phaseChecks[1] ?? 0);
    const correctionQubit = errorType === "X" ? block * 3 + bitPos : phaseBlock * 3;
    const corrected =
        (errorType === "X" && correctionQubit === errorQubit) ||
        (errorType === "Z" && phaseBlock === block);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(errorQubit, errorType, "idle", bitChecks, phaseChecks, false),
        edges: [],
        description: `Shor code: logical ${logical} encoded in nine physical qubits across three blocks of three.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { logical, errorQubit, errorType, bitChecks: [0, 0, 0, 0, 0, 0], phaseChecks: [0, 0], corrected: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(errorQubit, errorType, "error", bitChecks, phaseChecks, false),
        edges: [],
        description: `A single ${errorType} error is injected on physical qubit ${errorQubit} in block ${block}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { logical, errorQubit, errorType, bitChecks: [0, 0, 0, 0, 0, 0], phaseChecks: [0, 0], corrected: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(errorQubit, errorType, "syndrome", bitChecks, phaseChecks, false),
        edges: [],
        description: errorType === "X"
            ? `Bit-flip syndrome in block ${block} is ${bitChecks[2 * block]}${bitChecks[2 * block + 1]}, locating position ${bitPos} within the block.`
            : `Phase-flip syndrome across blocks is ${phaseChecks[0]}${phaseChecks[1]}, locating block ${phaseBlock}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { logical, errorQubit, errorType, bitChecks, phaseChecks, bitPos, phaseBlock, corrected: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(errorQubit, errorType, "done", bitChecks, phaseChecks, corrected),
        edges: [],
        description: `Apply the ${errorType} correction to qubit ${correctionQubit}; the logical state is restored: ${corrected}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { logical, errorQubit, errorType, bitChecks, phaseChecks, correctionQubit, corrected, done: true },
    };
}

/** The Shor code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Shor code protects one qubit by spreading it over nine. Three physical qubits form a block that can catch a single bit flip, like a tiny majority vote. Three such blocks then protect against a phase flip by comparing their signs. Measuring the right parities tells you both what kind of error happened and where, so you can undo it without ever measuring the logical qubit itself.",
        invariants: [
            "Each block of three corrects a single bit flip using two parity checks.",
            "The three blocks together correct a single phase flip using two block checks.",
            "The correction is a Pauli X or Z on a physical qubit, never a measurement of the logical state.",
        ],
        correctness:
            "For a bit flip in a block, the two parity checks Z1Z2 and Z2Z3 produce the distinct pairs 10, 11, and 01 for positions 0, 1, and 2, so the location is unique and applying X there cancels the error. For a phase flip, the error changes the relative sign of one block; the checks comparing blocks one-two and two-three produce 10, 11, and 01 for blocks 0, 1, and 2, so applying Z anywhere in that block restores the phase. Because X and Z corrections act only on the error's physical qubit, the encoded logical state is recovered.",
        complexityRationale:
            "With a fixed nine-qubit block, reading the syndrome and choosing a correction is a constant number of bit operations, so O(1) time and space. General distance-three codes scale the number of checks with the code size, but the Shor code's fixed layout keeps this teaching simulation constant.",
        uses: [
            "A historical first example of a quantum error-correcting code",
            "Teaching concatenated codes and the separation of bit-flip and phase-flip correction",
            "A stepping stone to modern stabilizer and surface codes",
        ],
        references: [
            "Shor, Scheme for Reducing Decoherence in Quantum Computer Memory, 1995",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10, 2010",
        ],
        workedExample:
            "An X error on qubit 4 (block 1, position 1) gives bit syndrome 11 in block 1, which uniquely selects position 1; applying X to qubit 4 restores the state. A Z error on qubit 7 (block 2) gives phase syndrome 01, identifying block 2; applying Z to any qubit in that block clears the phase error. The logical bit is never directly observed.",
    },
    id: "shor-code",
    name: "Shor Nine-Qubit Error-Correcting Code",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { logical: 0, errorQubit: 4, errorType: "X" },
    visualType: "point",
    run,
    pseudocode: [
        "encode one logical qubit into nine physical qubits",
        "inject a single X or Z error on one physical qubit",
        "measure the two parity checks in each three-qubit block",
        "measure the two block-comparison checks for phase errors",
        "decode the syndrome into an error location",
        "apply the matching X or Z correction",
        "done: confirm the logical state is restored",
    ],
};

export default module;
