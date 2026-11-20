/**
 * cutting-plane-method.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cutting-plane-method";
import type { VisualFrame } from "@/types";

function evalMax(lines: Array<{ m: number; b: number }>, x: number): number {
    return Math.max(...lines.map((line) => line.m * x + line.b));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(11);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kelley cutting-plane method", () => {
    it("finds a value matching a brute-force grid minimum", () => {
        const cases = [
            [{ m: -2, b: 0 }, { m: 1, b: 0 }, { m: 0.2, b: 3 }],
            [{ m: -1, b: 4 }, { m: 3, b: -2 }, { m: 0.5, b: 1 }],
            [{ m: -4, b: 10 }, { m: 2, b: -1 }],
        ];
        for (const lines of cases) {
            const frames = [...mod.run({ lines, lo: -5, hi: 5, iterations: 80, grid: 20001 })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            const x = Number(finalMeta?.["x"]);
            const value = Number(finalMeta?.["value"]);
            let bruteMin = Infinity;
            for (let j = 0; j <= 20000; j += 1) {
                const gridX = -5 + (10 * j) / 20000;
                bruteMin = Math.min(bruteMin, evalMax(lines, gridX));
            }
            expect(Math.abs(evalMax(lines, x) - value)).toBeLessThan(1e-9);
            expect(value).toBeLessThanOrEqual(bruteMin + 1e-3);
        }
    });

    it("bound gap never becomes negative", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const lower = frame.meta["lowerBound"];
            const upper = Number(frame.meta["upperBound"]);
            if (typeof lower === "number") {
                expect(lower).toBeLessThanOrEqual(upper + 1e-6);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
