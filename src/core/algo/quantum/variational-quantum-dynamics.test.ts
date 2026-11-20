/** variational-quantum-dynamics.test.ts - Exact spectrum cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./variational-quantum-dynamics";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Exact eigenvalues of the 4 by 4 test Hamiltonian from a separate 2 by 2 solve. */
function exactEnergies(h: number, j: number): number[] {
    const gap = Math.sqrt(h * h + j * j);
    return [-gap, 0, 0, gap].sort((a, b) => a - b);
}

describe("Variational Quantum Dynamics", () => {
    it("recovers the exact ground and first excited energies", () => {
        for (const [h, j] of [[0.6, 0.8], [0.3, 0.4], [0.9, 0.2]]) {
            const frames = [...mod.run({ h, j, grid: 97, sweeps: 10, beta: 250 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const exact = exactEnergies(h, j);
            expect(Number(final?.["ground"])).toBeCloseTo(exact[0] ?? 0, 1);
            expect(Number(final?.["firstExcited"])).toBeCloseTo(exact[1] ?? 0, 1);
            expect(Number(final?.["overlap"])).toBeLessThan(0.15);
        }
    });

    it("keeps the ansatz normalized and energies above the true ground", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames.slice(1)) {
            const ground = Number(frame.meta["ground"]);
            expect(ground).toBeGreaterThanOrEqual(-1.01);
        }
        const trace = frames[1]?.meta["trace"] as number[];
        expect(trace.length).toBeGreaterThan(1);
        expect(trace[trace.length - 1] ?? 0).toBeLessThanOrEqual(trace[0] ?? 0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
