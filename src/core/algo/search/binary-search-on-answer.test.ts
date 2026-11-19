/**
 * binary-search-on-answer.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import binaryOnAnswer from "./binary-search-on-answer";

function brute(lo: number, hi: number, target: number): number | null {
    for (let x = lo; x <= hi; x += 1) {
        if (x * x >= target) {
            return x;
        }
    }
    return null;
}

describe("BinarySearchOnAnswer", () => {
    it("matches brute force across many targets and ranges", () => {
        for (let target = -5; target <= 400; target += 7) {
            for (const [lo, hi] of [[0, 20], [3, 15], [0, 30]] as Array<[number, number]>) {
                const frames = [...binaryOnAnswer.run({ lo, hi, target })];
                const answer = frames.at(-1)?.meta.answer;
                const expected = brute(lo, hi, target);
                expect(answer, `target=${target} range=${lo}..${hi}`).toBe(expected === null ? "none" : expected);
            }
        }
    });

    it("reports no answer when the whole range fails", () => {
        const frames = [...binaryOnAnswer.run({ lo: 0, hi: 3, target: 1000 })];
        expect(frames.at(-1)?.meta.answer).toBe("none");
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...binaryOnAnswer.run({ lo: 0, hi: 20, target: 63 })];
        expect(frames.length).toBeGreaterThan(3);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("array");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(binaryOnAnswer.pseudocode?.length ?? 0);
        }
    });
});
