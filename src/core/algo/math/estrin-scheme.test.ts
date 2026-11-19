/** estrin-scheme.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./estrin-scheme";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function horner(coeffs: number[], x: number): number {
    let acc = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) acc = acc * x + coeffs[i]!;
    return acc;
}

describe("Estrin's scheme", () => {
    it("matches Horner's method across lengths and points", () => {
        const xs = [-3, -1, 0, 1, 2, 5];
        for (let n = 1; n <= 9; n += 1) {
            const coeffs = Array.from({ length: n }, (_, i) => ((i * 7 + 3) % 11) - 5);
            for (const x of xs) {
                const frames = [...mod.run({ coefficients: coeffs, x })];
                checkFrames(frames);
                const value = frames[frames.length - 1]?.meta["value"] as number;
                expect(value).toBe(horner(coeffs, x));
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
