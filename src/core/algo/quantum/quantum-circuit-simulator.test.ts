/**
 * quantum-circuit-simulator.test.ts - Independent full-matrix reference, norm
 * preservation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-circuit-simulator";
import type { VisualFrame } from "@/types";

type Complex = [number, number];
type Scalar = number | Complex;
interface Gate {
    gate: string;
    target: number;
    control?: number;
}

function toComplex(value: Scalar): Complex {
    return typeof value === "number" ? [value, 0] : value;
}
function cmul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
function cadd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

const S = Math.SQRT1_2;
const MATRICES: Record<string, [[Scalar, Scalar], [Scalar, Scalar]]> = {
    H: [
        [S, S],
        [S, -S],
    ],
    X: [
        [0, 1],
        [1, 0],
    ],
    Z: [
        [1, 0],
        [0, -1],
    ],
    S: [
        [1, 0],
        [0, [0, 1]],
    ],
};

/** Build the full 2^n matrix of one gate by its action on basis indices. */
function fullMatrix(n: number, g: Gate): Complex[][] {
    const size = 2 ** n;
    const U: Complex[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => [0, 0] as Complex),
    );
    if (g.gate === "CNOT") {
        const cbit = 1 << (n - 1 - (g.control ?? 0));
        const tbit = 1 << (n - 1 - g.target);
        for (let i = 0; i < size; i += 1) {
            const j = (i & cbit) !== 0 ? i | tbit : i;
            U[j]![i] = [1, 0];
        }
        return U;
    }
    const m = MATRICES[g.gate]!;
    const bit = 1 << (n - 1 - g.target);
    for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
            const otherI = i & ~bit;
            const otherJ = j & ~bit;
            if (otherI !== otherJ) {
                continue;
            }
            const bi = (i & bit) !== 0 ? 1 : 0;
            const bj = (j & bit) !== 0 ? 1 : 0;
            U[j]![i] = toComplex(m[bj]![bi]!);
        }
    }
    return U;
}

function applyFull(state: Complex[], n: number, g: Gate): Complex[] {
    const U = fullMatrix(n, g);
    return U.map((row) =>
        row.reduce((sum, u, i) => cadd(sum, cmul(u, state[i]!)), [0, 0] as Complex),
    );
}

function reference(n: number, gates: Gate[]): Complex[] {
    const size = 2 ** n;
    let state: Complex[] = Array.from({ length: size }, () => [0, 0]);
    state[0] = [1, 0];
    for (const g of gates) {
        state = applyFull(state, n, g);
    }
    return state;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 ** n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probabilities = frame.meta["probabilities"] as number[];
        expect(probabilities.length).toBe(2 ** n);
    });
}

describe("QuantumCircuitSimulator", () => {
    it("matches a full-matrix reference for several circuits", () => {
        const circuits: Array<{ n: number; gates: Gate[] }> = [
            { n: 2, gates: [{ gate: "H", target: 0 }, { gate: "CNOT", target: 1, control: 0 }] },
            { n: 3, gates: [{ gate: "H", target: 2 }, { gate: "H", target: 0 }, { gate: "CNOT", target: 1, control: 0 }] },
            { n: 3, gates: [{ gate: "X", target: 1 }, { gate: "Z", target: 0 }, { gate: "S", target: 2 }] },
            { n: 2, gates: [{ gate: "H", target: 0 }, { gate: "Z", target: 0 }, { gate: "H", target: 0 }] },
        ];
        for (const { n, gates } of circuits) {
            const frames = [...mod.run({ qubits: n, gates })];
            checkFrames(frames, n);
            const expected = reference(n, gates);
            const reals = frames[frames.length - 1]?.meta["reals"] as number[];
            const imags = frames[frames.length - 1]?.meta["imags"] as number[];
            for (let i = 0; i < expected.length; i += 1) {
                expect(reals[i]).toBeCloseTo(expected[i]![0], 10);
                expect(imags[i]).toBeCloseTo(expected[i]![1], 10);
            }
        }
    });

    it("produces a Bell state with unit norm", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 2);
        const probabilities = frames[frames.length - 1]?.meta["probabilities"] as number[];
        expect(probabilities[0]).toBeCloseTo(0.5, 10);
        expect(probabilities[1]).toBeCloseTo(0, 10);
        expect(probabilities[2]).toBeCloseTo(0, 10);
        expect(probabilities[3]).toBeCloseTo(0.5, 10);
        for (const frame of frames) {
            expect(Number(frame.meta["norm"])).toBeCloseTo(1, 10);
        }
    });

    it("applies H twice to return to the start", () => {
        const frames = [...mod.run({ qubits: 1, gates: [{ gate: "H", target: 0 }, { gate: "H", target: 0 }] })];
        checkFrames(frames, 1);
        const reals = frames[frames.length - 1]?.meta["reals"] as number[];
        expect(reals[0]).toBeCloseTo(1, 10);
        expect(reals[1]).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
