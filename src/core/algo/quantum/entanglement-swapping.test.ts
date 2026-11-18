/**
 * entanglement-swapping.test.ts - Exact state evolution, Bell outcome independence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./entanglement-swapping";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const amps = frame.meta["amplitudes"] as number[];
        const norm = Math.sqrt(amps.reduce((s, a) => s + a * a, 0));
        expect(norm).toBeCloseTo(1, 10);
    });
}

/** Direct marginal probability that the outer qubits agree, computed from the full state. */
function outerAgreement(amps: number[]): number {
    let agree = 0;
    for (let i = 0; i < 16; i += 1) {
        const q0 = i & 1;
        const q3 = (i >> 3) & 1;
        if (q0 === q3) agree += amps[i]! ** 2;
    }
    return agree;
}

describe("EntanglementSwapping", () => {
    it("produces a Bell pair on the outer qubits for every outcome", () => {
        for (let outcome = 0; outcome < 4; outcome += 1) {
            const frames = [...mod.run({ measure: outcome })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const outer = meta?.["outer"] as number[];
            expect(outer[0]).toBeCloseTo(Math.SQRT1_2, 6);
            expect(outer[1]).toBeCloseTo(0, 6);
            expect(outer[2]).toBeCloseTo(0, 6);
            expect(outer[3]).toBeCloseTo(Math.SQRT1_2, 6);
            expect(Number(meta?.["fidelity"])).toBeCloseTo(1, 6);
        }
    });

    it("outer qubits always agree, verified directly from the full amplitudes", () => {
        for (let outcome = 0; outcome < 4; outcome += 1) {
            const frames = [...mod.run({ measure: outcome })];
            const amps = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            expect(outerAgreement(amps)).toBeCloseTo(1, 6);
        }
    });

    it("has uniform outcome probabilities", () => {
        const frames = [...mod.run({ measure: 0 })];
        const probabilities = frames[2]?.meta["probabilities"] as number[];
        expect(probabilities.length).toBe(4);
        for (const p of probabilities) {
            expect(p).toBeCloseTo(0.25, 6);
        }
    });

    it("applies the correction exactly when the second bit is one", () => {
        for (let outcome = 0; outcome < 4; outcome += 1) {
            const frames = [...mod.run({ measure: outcome })];
            const meta = frames[frames.length - 1]?.meta;
            expect(Boolean(meta?.["corrected"])).toBe(((outcome >> 1) & 1) === 1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
