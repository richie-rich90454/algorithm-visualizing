/**
 * bernstein-vazirani.test.ts - Exhaustive oracle simulation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bernsteinVazirani } from "./bernstein-vazirani";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Bernstein-Vazirani", () => {
    it("recovers every hidden string across one to four qubits", () => {
        for (let qubits = 1; qubits <= 4; qubits += 1) {
            const size = 1 << qubits;
            for (let secret = 0; secret < size; secret += 1) {
                const data = bernsteinVazirani(qubits, secret);
                expect(data.measured).toBe(secret);
                expect(data.probability).toBeCloseTo(1, 12);
                const final = data.snapshots[data.snapshots.length - 1]!;
                for (let x = 0; x < size; x += 1) {
                    expect(Math.abs(final[x] ?? 0)).toBeCloseTo(x === secret ? 1 : 0, 12);
                }
                for (const snapshot of data.snapshots) {
                    const norm = snapshot.reduce((sum, a) => sum + a * a, 0);
                    expect(norm).toBeCloseTo(1, 12);
                }
                const frames = [...mod.run({ qubits, secret })];
                checkFrames(frames, size);
            }
        }
    });

    it("marks exactly the odd-parity inputs in the oracle frame", () => {
        const data = bernsteinVazirani(3, 5);
        const oracle = data.snapshots[2]!;
        for (let x = 0; x < 8; x += 1) {
            const popcount = (5 & x).toString(2).split("1").length - 1;
            const expectedNegative = popcount % 2 === 1;
            expect((oracle[x] ?? 0) < 0).toBe(expectedNegative);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
