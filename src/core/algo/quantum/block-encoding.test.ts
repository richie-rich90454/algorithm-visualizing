/**
 * block-encoding.test.ts - Normalized block equality, unitarity property,
 * diagonal norm check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./block-encoding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["flatU"] as number[]).length).toBe(16);
    });
}

describe("BlockEncoding", () => {
    it("places the normalized matrix in the upper-left block and is unitary", () => {
        const cases: Array<[number, number, number, number]> = [
            [0.5, 0, 0, 0.25],
            [0.3, 0.2, -0.1, 0.4],
            [0, 0.5, -0.5, 0],
            [1.2, -0.6, 0.4, 0.3],
        ];
        for (const [a, b, c, d] of cases) {
            const frames = [...mod.run({ a, b, c, d })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]!.meta;
            const alpha = meta["alpha"] as number;
            const normalized = meta["flatNormalized"] as number[];
            expect(normalized).toEqual([a / alpha, b / alpha, c / alpha, d / alpha]);
            const u = meta["flatU"] as number[];
            expect(u[0]).toBeCloseTo(normalized[0]!, 12);
            expect(u[1]).toBeCloseTo(normalized[1]!, 12);
            expect(u[4]).toBeCloseTo(normalized[2]!, 12);
            expect(u[5]).toBeCloseTo(normalized[3]!, 12);
            for (let i = 0; i < 4; i += 1) {
                for (let j = 0; j < 4; j += 1) {
                    let dot = 0;
                    for (let k = 0; k < 4; k += 1) dot += u[k * 4 + i]! * u[k * 4 + j]!;
                    expect(dot).toBeCloseTo(i === j ? 1 : 0, 8);
                }
            }
            expect(meta["residual"]).toBeLessThan(1e-8);
        }
    });

    it("uses the largest diagonal magnitude as alpha for a diagonal matrix", () => {
        const frames = [...mod.run({ a: 0.2, b: 0, c: 0, d: -0.7 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["alpha"]).toBeCloseTo(0.7, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
