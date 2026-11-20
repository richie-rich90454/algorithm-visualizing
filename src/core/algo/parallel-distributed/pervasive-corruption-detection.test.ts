/**
 * pervasive-corruption-detection.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pervasive-corruption-detection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Pervasive Corruption Detection", () => {
    it("flags exactly a single corrupted node wherever it sits", () => {
        const n = 6;
        for (let corrupted = 0; corrupted < n; corrupted += 1) {
            const frames = [...mod.run({ nodes: n, corrupted: [corrupted] })];
            checkFrames(frames, n);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["detected"]).toEqual([corrupted]);
            expect(last?.["flags"]).toEqual(Array.from({ length: n }, (_, index) => index === corrupted));
        }
    });

    it("flags nothing on an honest chain", () => {
        const frames = [...mod.run({ nodes: 5, corrupted: [] })];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["detected"]).toEqual([]);
        expect(last?.["done"]).toBe(true);
    });

    it("flags every corrupted node in a multi-corruption chain", () => {
        const frames = [...mod.run({ nodes: 6, corrupted: [1, 4] })];
        const last = frames[frames.length - 1]?.meta;
        expect([...(last?.["detected"] as number[])].sort((a, b) => a - b)).toEqual([1, 4]);
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
