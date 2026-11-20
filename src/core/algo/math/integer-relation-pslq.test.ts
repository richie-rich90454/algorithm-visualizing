/** integer-relation-pslq.test.ts - Relation verification, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./integer-relation-pslq";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(typeof frame.meta["rows"]).toBe("number");
        expect(typeof frame.meta["cols"]).toBe("number");
        expect(Array.isArray(frame.meta["residuals"]) || frame.meta["phase"] === "setup" || frame.meta["phase"] === "done").toBe(true);
        expect(frame.meta["n"]).toBe(n);
    });
}

function dot(relation: number[], values: number[]): number {
    return relation.reduce((sum, coefficient, index) => sum + coefficient * (values[index] ?? 0), 0);
}

describe("PSLQ Integer Relation Detection", () => {
    it("recovers known small integer relations", () => {
        const sqrt2 = Math.SQRT2;
        const phi = (1 + Math.sqrt(5)) / 2;
        const cases = [
            { values: [1, sqrt2, 1 + sqrt2] },
            { values: [1, phi, phi * phi] },
            { values: [sqrt2, Math.sqrt(3), sqrt2 + Math.sqrt(3)] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.values.length);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["found"]).toBe(true);
            const relation = final?.["relation"] as number[];
            expect(relation).toHaveLength(testCase.values.length);
            expect(relation.some((value) => value !== 0)).toBe(true);
            expect(Math.max(...relation.map(Math.abs))).toBeLessThan(1000);
            expect(Math.abs(dot(relation, testCase.values))).toBeLessThan(1e-7);
            expect(Math.abs(final?.["dot"] as number)).toBeLessThan(1e-7);
        }
    });

    it("uses the default input to find a relation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBe(true);
        expect(final?.["relation"]).toEqual([1, 1, -1]);
    });

    it("reports no small relation for three independent square roots", () => {
        const values = [Math.SQRT2, Math.sqrt(3), Math.sqrt(5)];
        const frames = [...mod.run({ values, maxSteps: 80 })];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBe(false);
        expect(final?.["relation"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
