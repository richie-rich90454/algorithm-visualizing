/**
 * stabilizer-formalism.test.ts - Stabilizer eigenvalue checks, gate consistency, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./stabilizer-formalism";
import type { VisualFrame } from "@/types";

interface PauliLike {
    x: boolean[];
    z: boolean[];
    sign: number;
}

function parseGenerator(text: string, n: number): PauliLike {
    const sign = text.startsWith("-") ? -1 : 1;
    const body = text.slice(1);
    return {
        sign,
        x: Array.from({ length: n }, (_, q) => body[q] === "X" || body[q] === "Y"),
        z: Array.from({ length: n }, (_, q) => body[q] === "Z" || body[q] === "Y"),
    };
}

/** Apply a real Pauli string to a state vector and return the result. */
function applyPauli(p: PauliLike, state: number[]): number[] {
    const n = p.x.length;
    const dim = 1 << n;
    const xmask = p.x.reduce((v, bit, q) => v | (bit ? 1 << q : 0), 0);
    const zmask = p.z.reduce((v, bit, q) => v | (bit ? 1 << q : 0), 0);
    const out = new Array<number>(dim).fill(0);
    for (let i = 0; i < dim; i += 1) {
        let parity = 0;
        let v = zmask & i;
        while (v !== 0) {
            parity ^= 1;
            v &= v - 1;
        }
        out[i ^ xmask] = p.sign * (parity ? -1 : 1) * state[i]!;
    }
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * (n + 1));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(1 << n);
        const norm = Math.sqrt(amps.reduce((s, a) => s + a * a, 0));
        expect(norm).toBeCloseTo(1, 8);
    });
}

describe("StabilizerFormalism", () => {
    it("derived state is a plus-one eigenvector of every final generator", () => {
        const cases = [
            { n: 2, initial: "zero" as const, gates: [{ type: "H", q: 0 }] },
            { n: 2, initial: "plus" as const, gates: [{ type: "CNOT", control: 0, target: 1 }] },
            { n: 2, initial: "bell" as const, gates: [{ type: "H", q: 0 }] },
            { n: 3, initial: "zero" as const, gates: [{ type: "H", q: 0 }, { type: "CNOT", control: 0, target: 1 }] },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, c.n);
            const meta = frames[frames.length - 1]?.meta;
            const state = meta?.["amplitudes"] as number[];
            const generators = meta?.["generators"] as string[];
            expect(generators.length).toBe(c.n);
            expect(Number(meta?.["groupSize"])).toBe(2 ** c.n);
            for (const g of generators) {
                const applied = applyPauli(parseGenerator(g, c.n), state);
                const plus = applied.reduce((s, a, i) => s + (a - state[i]!) ** 2, 0);
                const minus = applied.reduce((s, a, i) => s + (a + state[i]!) ** 2, 0);
                expect(Math.min(plus, minus)).toBeLessThan(1e-8);
            }
        }
    });

    it("Hadamard on a computational-basis state produces the plus state", () => {
        const frames = [...mod.run({ n: 1, initial: "zero", gates: [{ type: "H", q: 0 }] })];
        const state = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(Math.abs(state[0]!)).toBeCloseTo(Math.SQRT1_2, 6);
        expect(Math.abs(state[1]!)).toBeCloseTo(Math.SQRT1_2, 6);
    });

    it("derived state matches exact state-vector CNOT after the gate", () => {
        // Start from |0>|0>, apply H then CNOT to get a Bell pair; amplitude pattern 0 and 3.
        const frames = [...mod.run({ n: 2, initial: "zero", gates: [{ type: "H", q: 0 }, { type: "CNOT", control: 0, target: 1 }] })];
        const state = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(Math.abs(state[0]!)).toBeCloseTo(Math.SQRT1_2, 6);
        expect(state[1]!).toBeCloseTo(0, 6);
        expect(state[2]!).toBeCloseTo(0, 6);
        expect(Math.abs(state[3]!)).toBeCloseTo(Math.SQRT1_2, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
