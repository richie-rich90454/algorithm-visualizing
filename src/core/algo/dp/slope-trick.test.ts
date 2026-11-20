/**
 * slope-trick.test.ts - Brute-force DP cross-check for slope trick.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./slope-trick";

function referenceCost(values: number[]): number {
    if (values.length === 0) return 0;
    const lo = Math.min(...values) - 1;
    const hi = Math.max(...values) + 1;
    let previous = Array.from({ length: hi - lo + 1 }, () => 0);
    for (const value of values) {
        let running = Number.POSITIVE_INFINITY;
        const current = new Array<number>(previous.length).fill(0);
        for (let x = 0; x < previous.length; x += 1) {
            running = Math.min(running, previous[x] ?? 0);
            current[x] = running + Math.abs(lo + x - value);
        }
        previous = current;
    }
    return Math.min(...previous);
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(entity.type).toBe("bar");
            expect(Number.isFinite(entity.value as number)).toBe(true);
        }
    });
}

describe("Slope Trick", () => {
    it("matches an explicit two-dimensional DP on random inputs", () => {
        for (let trial = 0; trial < 80; trial += 1) {
            const n = 1 + (trial % 8);
            const values = Array.from({ length: n }, () => Math.floor(Math.random() * 21));
            const frames = [...module.run({ arr: values })];
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            expect(final?.meta.answer).toBe(referenceCost(values));
        }
    });

    it("handles the empty input and a monotone input", () => {
        const empty = [...module.run({ arr: [] })];
        expect(empty[empty.length - 1]?.meta.answer).toBe(0);
        const monotone = [...module.run({ arr: [1, 2, 3, 4, 5] })];
        expect(monotone[monotone.length - 1]?.meta.answer).toBe(0);
        verifyFrameShapes(empty);
        verifyFrameShapes(monotone);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
