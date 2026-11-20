/**
 * lambert-w-function.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lambert-w-function";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Lambert W Function", () => {
    it("satisfies w*exp(w)=x on the principal branch", () => {
        for (const x of [0.1, 0.5, 1, Math.E, 2, 10]) {
            const frames = [...mod.run({ x, iterations: 20 })];
            checkFrames(frames);
            const w = Number(frames[frames.length - 1]?.meta["value"]);
            expect(w * Math.exp(w)).toBeCloseTo(x, 9);
        }
    });

    it("returns known special values", () => {
        const atE = [...mod.run({ x: Math.E })];
        expect(Number(atE[atE.length - 1]?.meta["value"])).toBeCloseTo(1, 10);
        const atOne = [...mod.run({ x: 1 })];
        expect(Number(atOne[atOne.length - 1]?.meta["value"])).toBeCloseTo(0.5671432904097838, 10);
    });

    it("reports no real value below -1/e", () => {
        const frames = [...mod.run({ x: -1 })];
        checkFrames(frames);
        expect(frames[0]?.meta["error"]).toBe(true);
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
