/**
 * transversal-gate.test.ts - Logical action and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./transversal-gate";
import type { VisualFrame } from "@/types";

function reference(theta: number, gates: string[]): [number, number] {
    let a = Math.cos(theta);
    let b = Math.sin(theta);
    for (const gate of gates) {
        if (gate === "X") [a, b] = [b, a];
        else b = -b;
    }
    return [a, b];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Transversal logical gate", () => {
    it("matches the abstract logical qubit action", () => {
        const theta = Math.PI / 5;
        const gates = ["X", "Z", "X", "Z"];
        const frames = [...mod.run({ theta, gates })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const expected = reference(theta, gates);
        const logical = final["logicalAmplitudes"] as number[];
        expect(logical[0]).toBeCloseTo(expected[0], 9);
        expect(logical[1]).toBeCloseTo(expected[1], 9);
    });

    it("stays in the code space with unit stabilizers", () => {
        const frames = [...mod.run({ theta: 0.7, gates: ["X", "Z", "X", "X", "Z"] })];
        for (const frame of frames) {
            expect(Number(frame.meta["codeFidelity"])).toBeCloseTo(1, 9);
            const stabilizers = frame.meta["stabilizers"] as number[];
            for (const value of stabilizers) expect(value).toBeCloseTo(1, 9);
            const bars = frame.entities.map((e) => Number(e.value));
            for (let i = 1; i <= 6; i += 1) expect(bars[i]).toBeCloseTo(0, 9);
        }
    });

    it("obeys Pauli gate algebra", () => {
        const xx = [...mod.run({ theta: 0.9, gates: ["X", "X"] })];
        const zz = [...mod.run({ theta: 0.9, gates: ["Z", "Z"] })];
        const none = [...mod.run({ theta: 0.9, gates: [] })];
        for (const [frames] of [[xx], [zz]] as Array<[VisualFrame[]]>) {
            const logical = frames[frames.length - 1]!.meta["logicalAmplitudes"] as number[];
            const base = none[none.length - 1]!.meta["logicalAmplitudes"] as number[];
            expect(logical[0]).toBeCloseTo(base[0]!, 9);
            expect(logical[1]).toBeCloseTo(base[1]!, 9);
        }
        const xz = [...mod.run({ theta: 0.9, gates: ["X", "Z"] })];
        const zx = [...mod.run({ theta: 0.9, gates: ["Z", "X"] })];
        const xzLogical = xz[xz.length - 1]!.meta["logicalAmplitudes"] as number[];
        const zxLogical = zx[zx.length - 1]!.meta["logicalAmplitudes"] as number[];
        for (let i = 0; i < 2; i += 1) {
            expect(xzLogical[i]).toBeCloseTo(-zxLogical[i]!, 9);
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
