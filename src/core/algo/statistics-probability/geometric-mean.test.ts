/** geometric-mean.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./geometric-mean";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference: exponentiate the mean of the logarithms. */
function reference(values: number[]): number {
    return Math.exp(values.reduce((sum, v) => sum + Math.log(v), 0) / values.length);
}

describe("Geometric Mean", () => {
    it("matches the log-space reference on several inputs", () => {
        const cases = [
            [1, 2, 4, 8, 16],
            [2, 8],
            [3, 3, 3, 3],
            [0.5, 2, 4, 0.25],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["valid"]).toBe(true);
            expect(Number(finalMeta?.["result"])).toBeCloseTo(reference(values), 9);
            expect(frames.length).toBe(values.length + 2);
        }
    });

    it("matches the direct nth-root definition on small products", () => {
        const values = [1, 2, 4, 8, 16];
        const frames = [...mod.run({ values })];
        const result = Number(frames[frames.length - 1]?.meta["result"]);
        expect(result).toBeCloseTo(Math.pow(values.reduce((a, b) => a * b, 1), 1 / values.length), 9);
    });

    it("reports an undefined result for empty or nonpositive input", () => {
        const empty = [...mod.run({ values: [] })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["valid"]).toBe(false);
        const bad = [...mod.run({ values: [1, 0, 4] })];
        checkFrames(bad);
        expect(bad[bad.length - 1]?.meta["valid"]).toBe(false);
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
