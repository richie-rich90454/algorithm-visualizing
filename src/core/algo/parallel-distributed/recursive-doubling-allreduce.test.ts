/**
 * recursive-doubling-allreduce.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./recursive-doubling-allreduce";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(p * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function lastRow(metaFrame: Record<string, unknown>, p: number): number[] {
    const flat = metaFrame["historyFlat"] as number[];
    const cols = Number(metaFrame["cols"]);
    return flat.slice((cols - 1) * p, cols * p);
}

describe("Recursive doubling allreduce", () => {
    it("gives every rank the brute-force total on the default input", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        const p = 8;
        checkFrames(frames, p, 4);
        const expectedTotal = input.values.reduce((sum, v) => sum + v, 0);
        const metaFrame = finalMeta(frames);
        expect(metaFrame["total"]).toBe(expectedTotal);
        const last = lastRow(metaFrame, p);
        expect(last.length).toBe(p);
        for (const value of last) {
            expect(value).toBe(expectedTotal);
        }
    });

    it("matches a brute-force reduction over several power-of-two sizes", () => {
        const cases = [
            [5],
            [2, 9],
            [1, 2, 3, 4],
            [10, -3, 7, 2, 8, -1, 4, 6],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        ];
        for (const values of cases) {
            const p = 2 ** Math.ceil(Math.log2(values.length));
            const frames = [...mod.run({ values })];
            const metaFrame = finalMeta(frames);
            const total = values.reduce((sum, v) => sum + v, 0);
            const last = lastRow(metaFrame, p);
            expect(metaFrame["total"]).toBe(total);
            expect(last.length).toBe(p);
            for (const value of last) {
                expect(value).toBeCloseTo(total, 9);
            }
        }
    });

    it("uses log(p) rounds and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) {
            frames.push(frame);
        }
        const metaFrame = finalMeta(frames);
        expect(metaFrame["rounds"]).toBe(3);
        expect(frames.length).toBe(5); // initial + 3 rounds + final
        expect(generator.next().done).toBe(true);
    });
});
