/**
 * quantum-random-number-generator.test.ts - Determinism, Born-rule bias checks,
 * and a statistical balance test, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-random-number-generator";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function bitString(input: object): string {
    const frames = [...mod.run(input)];
    return String(frames[frames.length - 1]?.meta["bitString"]);
}

describe("Quantum Random Number Generator", () => {
    it("emits well-formed frames and a consistent integer", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const str = meta["bitString"] as string;
        expect(str).toHaveLength(8);
        expect(meta["value"]).toBe(Number.parseInt(str, 2));
        expect(Number(meta["prob0"])).toBeCloseTo(0.5, 9);
    });

    it("is reproducible for a fixed seed", () => {
        expect(bitString({ bits: 16, seed: 77 })).toBe(bitString({ bits: 16, seed: 77 }));
        expect(bitString({ bits: 16, seed: 77 })).not.toBe(bitString({ bits: 16, seed: 78 }));
    });

    it("is deterministic at zero and pi-over-two rotations", () => {
        expect(bitString({ bits: 12, seed: 1, angle: 0 })).toBe("000000000000");
        expect(bitString({ bits: 12, seed: 1, angle: Math.PI / 2 })).toBe("111111111111");
    });

    it("produces roughly balanced bits for an unbiased rotation", () => {
        let zeros = 0;
        let total = 0;
        for (let i = 0; i < 100; i += 1) {
            const str = bitString({ bits: 20, seed: i * 7919 + 1 });
            for (const bit of str) {
                total += 1;
                if (bit === "0") {
                    zeros += 1;
                }
            }
        }
        expect(total).toBe(2000);
        expect(zeros).toBeGreaterThan(900);
        expect(zeros).toBeLessThan(1100);
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
