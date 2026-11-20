/**
 * toffoli-gate.test.ts - Exhaustive basis-state verification of CCNOT and an
 * independent superposition cross-check, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./toffoli-gate";
import type { VisualFrame } from "@/types";

const BASIS = ["000", "001", "010", "011", "100", "101", "110", "111"];
const INV = Math.SQRT1_2;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(8);
        const norm = amps.reduce((s, a) => s + a * a, 0);
        expect(Math.abs(norm - 1)).toBeLessThan(1e-9);
    });
}

/** Independent real-amplitude simulation of H on the two controls plus CCNOT. */
function reference(initial: string, superpose: boolean): number[] {
    const state = new Array<number>(8).fill(0);
    state[Number.parseInt(initial, 2)] = 1;
    if (superpose) {
        for (const qubit of [0, 1]) {
            const mask = 1 << (2 - qubit);
            for (let i = 0; i < 8; i += 1) {
                if (i & mask) {
                    continue;
                }
                const a = state[i] ?? 0;
                const b = state[i | mask] ?? 0;
                state[i] = INV * (a + b);
                state[i | mask] = INV * (a - b);
            }
        }
    }
    const tmp = state[6] ?? 0;
    state[6] = state[7] ?? 0;
    state[7] = tmp;
    return state;
}

describe("Toffoli Gate", () => {
    it("flips the target for exactly the two control-one basis states", () => {
        for (const bits of BASIS) {
            const frames = [...mod.run({ initial: bits, superposeControls: false })];
            checkFrames(frames);
            const amps = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            const bothControlsOne = bits[0] === "1" && bits[1] === "1";
            const expectedIndex = Number.parseInt(bits, 2) ^ (bothControlsOne ? 1 : 0);
            for (let i = 0; i < 8; i += 1) {
                expect(amps[i]).toBeCloseTo(i === expectedIndex ? 1 : 0, 9);
            }
        }
    });

    it("matches an independent simulation when the controls are superposed", () => {
        const frames = [...mod.run({ initial: "001", superposeControls: true })];
        const amps = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        const expected = reference("001", true);
        for (let i = 0; i < 8; i += 1) {
            expect(amps[i]).toBeCloseTo(expected[i] ?? 0, 9);
        }
    });

    it("never changes a state whose controls are not both one", () => {
        const frames = [...mod.run({ initial: "101", superposeControls: false })];
        const amps = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(amps[5]).toBeCloseTo(1, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
