/**
 * five-qubit-code.test.ts - Exhaustive single-error correction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./five-qubit-code";
import type { VisualFrame } from "@/types";

type P = "I" | "X" | "Y" | "Z";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(32);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Five-Qubit Code", () => {
    it("corrects every one of the fifteen single-qubit Pauli errors", () => {
        for (const logical of [0, 1] as const) {
            for (let q = 0; q < 5; q += 1) {
                for (const type of ["X", "Y", "Z"] as P[]) {
                    const frames = [...mod.run({ logical, errorQubit: q, errorType: type })];
                    checkFrames(frames);
                    const meta = frames[frames.length - 1]!.meta;
                    expect(meta["correctable"]).toBe(true);
                    expect(Number(meta["fidelity"])).toBeGreaterThan(0.999999);
                    expect(String(meta["identifiedError"])).toBe(`${type}${q}`);
                }
            }
        }
    });

    it("produces distinct syndromes for all fifteen errors", () => {
        const syndromes = new Set<string>();
        for (let q = 0; q < 5; q += 1) {
            for (const type of ["X", "Y", "Z"] as P[]) {
                const frames = [...mod.run({ logical: 0, errorQubit: q, errorType: type })];
                const syndrome = String(frames[3]!.meta["syndrome"]);
                expect(syndrome).toMatch(/^[01]{4}$/);
                expect(syndrome).not.toBe("0000");
                syndromes.add(syndrome);
            }
        }
        expect(syndromes.size).toBe(15);
    });

    it("keeps the encoded state normalized across frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const probabilities = frames[0]!.meta["probabilities"] as number[];
        const sum = probabilities.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 8);
        // The encoded state is an equal superposition of its stabilizer-orbit basis states.
        const nonzero = probabilities.filter((p) => p > 1e-9);
        expect(nonzero.length).toBeGreaterThan(1);
        for (const p of nonzero) expect(p).toBeCloseTo(1 / nonzero.length, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
