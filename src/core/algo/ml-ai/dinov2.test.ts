/**
 * dinov2.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dinov2";
import type { VisualFrame } from "@/types";

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / total);
}

function crossEntropy(target: number[], student: number[]): number {
    let total = 0;
    for (let i = 0; i < target.length; i += 1) {
        total -= (target[i] ?? 0) * Math.log(Math.max(student[i] ?? 0, 1e-12));
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DINOv2 (Self-Distillation Loss)", () => {
    it("teacher and student distributions are valid and losses match recomputation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const target = final["target"] as number[];
        const teacherLogits = final["teacherLogits"] as number[];
        const center = final["center"] as number[];
        const tauT = Number(final["tauT"]);
        expect(target.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        target.forEach((value, i) => {
            expect(value).toBeCloseTo(softmax(teacherLogits.map((l, j) => (l - (center[j] ?? 0)) / tauT))[i] ?? 0, 9);
        });
        const studentAfter = final["studentProbsAfter"] as number[];
        expect(studentAfter.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(Number(final["lossAfter"])).toBeCloseTo(crossEntropy(target, studentAfter), 9);
    });

    it("strictly lowers the cross-entropy", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(Number(final["lossAfter"])).toBeLessThan(Number(final["lossBefore"]));
        expect(Number(final["lossAfter"])).toBeGreaterThanOrEqual(0);
    });

    it("matches recomputation for alternate logits", () => {
        const frames = [...mod.run({ teacherLogits: [1, 3, 0], studentLogits: [0, 0, 0] })];
        const final = frames[frames.length - 1]?.meta ?? {};
        const target = final["target"] as number[];
        const student = final["studentProbsAfter"] as number[];
        expect(Number(final["lossAfter"])).toBeCloseTo(crossEntropy(target, student), 9);
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
