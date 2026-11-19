/**
 * knowledge-distillation.test.ts - Distribution validity, finite-difference gradient, loss decrease, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { distillationForward, distillationStep } from "./knowledge-distillation";
import type { VisualFrame } from "@/types";

type Input = { teacherLogits: number[]; studentLogits: number[]; temperature: number; alpha: number; label: number; lr: number };

function lossOf(zs: number[], input: Input): number {
    return distillationForward(input.teacherLogits, zs, input.temperature, input.alpha, input.label).loss;
}

function checkFrames(frames: VisualFrame[], c: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(c);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Knowledge Distillation", () => {
    it("produces valid distributions and a nonnegative KL term", () => {
        const input = mod.defaultInput as Input;
        const f = distillationForward(input.teacherLogits, input.studentLogits, input.temperature, input.alpha, input.label);
        expect(f.teacherSoft.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(f.studentSoft.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(f.studentHard.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(f.softLoss).toBeGreaterThanOrEqual(0);
    });

    it("gradient matches central finite differences for every student logit", () => {
        const input = mod.defaultInput as Input;
        const r = distillationStep(input.teacherLogits, input.studentLogits, input.temperature, input.alpha, input.label, input.lr);
        const h = 1e-6;
        r.grad.forEach((gradient, j) => {
            const plus = input.studentLogits.map((v, k) => (k === j ? v + h : v));
            const minus = input.studentLogits.map((v, k) => (k === j ? v - h : v));
            const finite = (lossOf(plus, input) - lossOf(minus, input)) / (2 * h);
            expect(gradient).toBeCloseTo(finite, 6);
        });
    });

    it("reduces the blended loss after one step", () => {
        const input = { ...(mod.defaultInput as Input), lr: 0.05 };
        const r = distillationStep(input.teacherLogits, input.studentLogits, input.temperature, input.alpha, input.label, input.lr);
        expect(r.lossAfter).toBeLessThan(r.loss);
    });

    it("reports the loss in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.teacherLogits.length);
        const r = distillationStep(input.teacherLogits, input.studentLogits, input.temperature, input.alpha, input.label, input.lr);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["loss"])).toBeCloseTo(r.loss, 6);
        expect(Number(finalMeta?.["lossAfter"])).toBeCloseTo(r.lossAfter, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
