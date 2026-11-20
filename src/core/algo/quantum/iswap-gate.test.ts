/**
 * iswap-gate.test.ts - Basis action, unitarity, concurrence, frame shape,
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./iswap-gate";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        const probabilities = frame.meta["probabilities"] as number[];
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    });
}

describe("IswapGate", () => {
    it("maps the computational basis states as expected", () => {
        const from01 = [...mod.run({ theta: 0, phi: 0 })];
        checkFrames(from01);
        const p01 = from01[1]!.meta["probabilities"] as number[];
        [0, 0, 1, 0].forEach((value, i) => expect(p01[i]).toBeCloseTo(value, 10));
        const p01x2 = from01[2]!.meta["probabilities"] as number[];
        [0, 1, 0, 0].forEach((value, i) => expect(p01x2[i]).toBeCloseTo(value, 10));

        const from10 = [...mod.run({ theta: Math.PI / 2, phi: 0 })];
        checkFrames(from10);
        const p10 = from10[1]!.meta["probabilities"] as number[];
        [0, 1, 0, 0].forEach((value, i) => expect(p10[i]).toBeCloseTo(value, 10));
    });

    it("has a unitary matrix", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const gate = frames[0]!.meta["gate"] as number[];
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                let sum = 0;
                for (let k = 0; k < 4; k += 1) {
                    const a = gate[(k * 4 + i) * 2]!;
                    const ai = gate[(k * 4 + i) * 2 + 1]!;
                    const b = gate[(k * 4 + j) * 2]!;
                    const bi = gate[(k * 4 + j) * 2 + 1]!;
                    sum += a * b + ai * bi;
                }
                expect(sum).toBeCloseTo(i === j ? 1 : 0, 12);
            }
        }
    });

    it("reports maximal concurrence for an equal superposition and zero for a basis state", () => {
        const bell = [...mod.run({ theta: Math.PI / 4, phi: 0 })];
        checkFrames(bell);
        expect(bell[1]!.meta["concurrence"]).toBeCloseTo(1, 10);

        const basis = [...mod.run({ theta: 0, phi: 0 })];
        checkFrames(basis);
        expect(basis[1]!.meta["concurrence"]).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
