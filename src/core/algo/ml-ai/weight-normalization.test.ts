/**
 * weight-normalization.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./weight-normalization";
import type { VisualFrame } from "@/types";

type Input = { weights: number[][] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Weight Normalization", () => {
    it("reconstructs each weight exactly from magnitude and unit direction", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const rowFrames = frames.filter((f) => f.codeLineNumber === 4 && typeof f.meta["direction"] === "object");
        expect(rowFrames.length).toBe(input.weights.length);
        rowFrames.forEach((frame, r) => {
            const original = input.weights[r] ?? [];
            const direction = frame.meta["direction"] as number[];
            const reconstructed = frame.meta["reconstructed"] as number[];
            const norm = Math.sqrt(original.reduce((a, v) => a + v * v, 0));
            expect(Number(frame.meta["norm"])).toBeCloseTo(norm, 6);
            const directionNorm = Math.sqrt(direction.reduce((a, v) => a + v * v, 0));
            expect(directionNorm).toBeCloseTo(norm > 0 ? 1 : 0, 6);
            reconstructed.forEach((value, i) => expect(value).toBeCloseTo(original[i] ?? 0, 6));
            expect(Number(frame.meta["maxError"])).toBeLessThan(1e-9);
        });
    });

    it("handles a zero weight vector without NaN", () => {
        const frames = [...mod.run({ weights: [[0, 0], [3, 4]] })];
        const zeroFrame = frames.find((f) => f.meta["row"] === 0 && typeof f.meta["direction"] === "object");
        expect(zeroFrame).toBeDefined();
        const direction = zeroFrame?.meta["direction"] as number[];
        direction.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
