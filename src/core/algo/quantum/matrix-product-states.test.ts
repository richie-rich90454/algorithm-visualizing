/**
 * matrix-product-states.test.ts - Entanglement and fidelity cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./matrix-product-states";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], amplitudes: number, bonds: number): void {
    expect(frames.length).toBe(bonds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(amplitudes + bonds);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Matrix product states (TT-SVD)", () => {
    it("a product state has unit bond dimension and zero entropy", () => {
        const frames = [...mod.run({ qubits: 4, bondDimension: 4, state: "product" })];
        checkFrames(frames, 16, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bonds"]).toEqual([1, 1, 1]);
        for (const e of final?.["entropies"] as number[]) expect(e).toBeCloseTo(0, 8);
        expect(Number(final?.["fidelity"])).toBeCloseTo(1, 8);
    });

    it("a GHZ state has bond dimension two and one bit of entropy per cut", () => {
        for (const qubits of [3, 4, 5]) {
            const frames = [...mod.run({ qubits, bondDimension: 4, state: "ghz" })];
            checkFrames(frames, 1 << qubits, qubits - 1);
            const final = frames[frames.length - 1]?.meta;
            const bonds = final?.["bonds"] as number[];
            expect(bonds.every((b) => b === 2)).toBe(true);
            for (const e of final?.["entropies"] as number[]) expect(e).toBeCloseTo(1, 8);
            expect(Number(final?.["fidelity"])).toBeCloseTo(1, 6);
        }
    });

    it("truncating a GHZ state to bond dimension one loses fidelity", () => {
        const full = [...mod.run({ qubits: 4, bondDimension: 4, state: "ghz" })];
        const truncated = [...mod.run({ qubits: 4, bondDimension: 1, state: "ghz" })];
        expect(Number(full[full.length - 1]?.meta["fidelity"])).toBeCloseTo(1, 6);
        expect(Number(truncated[truncated.length - 1]?.meta["fidelity"])).toBeLessThan(0.9);
        expect(truncated[truncated.length - 1]?.meta["bonds"]).toEqual([1, 1, 1]);
    });

    it("a generic state reaches its maximal Schmidt rank at every cut", () => {
        const frames = [...mod.run({ qubits: 4, bondDimension: 8, state: "random" })];
        checkFrames(frames, 16, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bonds"]).toEqual([2, 4, 2]);
        expect(Number(final?.["fidelity"])).toBeCloseTo(1, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
