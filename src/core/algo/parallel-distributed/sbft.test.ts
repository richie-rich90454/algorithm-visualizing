/**
 * sbft.test.ts - Quorum safety properties, reference verdicts, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sbft";
import type { VisualFrame } from "@/types";

function reference(replicas: number, faulty: number[], value: number) {
    const f = Math.floor((replicas - 1) / 3);
    const threshold = f + 1;
    const slowThreshold = 2 * f + 1;
    const matching = replicas - faulty.length;
    const conflicting = faulty.length;
    const safetyViolation = conflicting >= threshold;
    return {
        f,
        threshold,
        slowThreshold,
        matching,
        conflicting,
        fastPath: matching >= threshold,
        slowPath: matching >= slowThreshold,
        safetyViolation,
        committed: matching >= threshold && !safetyViolation,
    };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SBFT", () => {
    it("matches a reference verdict on the default input", () => {
        const input = mod.defaultInput as { replicas: number; faulty: number[]; value: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const expected = reference(input.replicas, input.faulty, input.value);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["f"]).toBe(expected.f);
        expect(final?.["threshold"]).toBe(expected.threshold);
        expect(final?.["shares"]).toBe(expected.matching);
        expect(final?.["conflicting"]).toBe(expected.conflicting);
        expect(final?.["fastPath"]).toBe(expected.fastPath);
        expect(final?.["committed"]).toBe(expected.committed);
        expect(final?.["safetyViolation"]).toBe(expected.safetyViolation);
    });

    it("always commits within the f fault tolerance bound", () => {
        for (const replicas of [4, 7, 10, 13]) {
            const f = Math.floor((replicas - 1) / 3);
            for (let faultyCount = 0; faultyCount <= f; faultyCount += 1) {
                const faulty = Array.from({ length: faultyCount }, (_, i) => i);
                const frames = [...mod.run({ replicas, faulty, value: 5 })];
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["committed"]).toBe(true);
                expect(final?.["safetyViolation"]).toBe(false);
                expect(Number(final?.["shares"])).toBeGreaterThanOrEqual(Number(final?.["threshold"]));
            }
        }
    });

    it("flags a safety violation once conflicting shares reach the threshold", () => {
        for (const replicas of [4, 7, 10]) {
            const f = Math.floor((replicas - 1) / 3);
            const faulty = Array.from({ length: f + 1 }, (_, i) => i);
            const frames = [...mod.run({ replicas, faulty, value: 5 })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["safetyViolation"]).toBe(true);
            expect(final?.["committed"]).toBe(false);
            expect(reference(replicas, faulty, 5).safetyViolation).toBe(true);
        }
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
