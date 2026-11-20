/**
 * gradecast.test.ts - Graded broadcast correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gradecast";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Graded Broadcast", () => {
    it("gives every process grade two for a unanimous honest input", () => {
        const frames = [...mod.run({ inputs: [1, 1, 1, 1], faults: 0, byzantineValue: 0 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const outputs = final?.["outputs"] as Array<{ value: number; grade: number }>;
        expect(outputs.length).toBe(4);
        outputs.forEach((o) => {
            expect(o.value).toBe(1);
            expect(o.grade).toBe(2);
        });
        expect(final?.["gradedAgreement"]).toBe(true);
    });

    it("tallies reports independently for each process", () => {
        const inputs = [1, 1, 1, 1, 1, 1, 1];
        const f = 2;
        const frames = [...mod.run({ inputs, faults: f, byzantineValue: 0 })];
        const outputs = frames[frames.length - 1]?.meta["outputs"] as Array<{ value: number; grade: number; count: number }>;
        // Each process sees 7-f honest reports of 1 and f reports of 0.
        outputs.forEach((o) => {
            expect(o.value).toBe(1);
            expect(o.count).toBe(7 - f);
            expect(o.grade).toBe(2);
        });
    });

    it("keeps all grade-two values consistent under a faulty sender", () => {
        const frames = [...mod.run({ inputs: [0, 1, 1, 1, 1, 1, 1], faults: 2, byzantineValue: 0 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const gradeTwo = final?.["gradeTwoValues"] as number[];
        expect(gradeTwo.length).toBeLessThanOrEqual(1);
        expect(final?.["gradedAgreement"]).toBe(true);
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
