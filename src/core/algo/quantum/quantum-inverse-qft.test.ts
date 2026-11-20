/**
 * quantum-inverse-qft.test.ts - Round-trip identity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-inverse-qft";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], dimension: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dimension);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Inverse Quantum Fourier Transform", () => {
    it("restores every basis state exactly", () => {
        for (let qubits = 1; qubits <= 4; qubits += 1) {
            const dimension = 1 << qubits;
            for (let basis = 0; basis < dimension; basis += 1) {
                const frames = [...mod.run({ qubits, basis })];
                checkFrames(frames, dimension);
                const final = frames[frames.length - 1]!.meta;
                expect(Number(final["fidelity"])).toBeCloseTo(1, 10);
                const output = final["output"] as number[];
                expect(output[basis]).toBeCloseTo(1, 10);
                output.forEach((value, index) => {
                    if (index !== basis) expect(value).toBeLessThan(1e-10);
                });
                const spectrum = final["spectrum"] as number[];
                spectrum.forEach((value) => expect(value).toBeCloseTo(1 / dimension, 10));
            }
        }
    });

    it("keeps probability normalized", () => {
        const frames = [...mod.run({ qubits: 5, basis: 17 })];
        checkFrames(frames, 32);
        for (const frame of frames) {
            const values = (frame.meta["spectrum"] as number[]).length > 0
                ? (frame.meta["spectrum"] as number[])
                : (frame.meta["input"] as number[]);
            expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
