/**
 * instance-normalization.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./instance-normalization";
import type { VisualFrame } from "@/types";

type Input = { data: number[][]; gamma: number; beta: number; eps: number };

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
        expect(frame.meta).toBeDefined();
    });
}

function reference(data: number[][], gamma: number, beta: number, eps: number): number[][] {
    return data.map((row) => {
        const n = row.length;
        const mean = n > 0 ? row.reduce((a, v) => a + v, 0) / n : 0;
        const variance = n > 0 ? row.reduce((a, v) => a + (v - mean) ** 2, 0) / n : 0;
        const std = Math.sqrt(variance + eps);
        return row.map((v) => gamma * ((v - mean) / std) + beta);
    });
}

describe("Instance Normalization", () => {
    it("matches an independent reference and standardizes each sample", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.data, input.gamma, input.beta, input.eps);
        const final = frames[frames.length - 1]?.meta;
        const output = final?.["output"] as number[];
        let index = 0;
        expected.forEach((row) => {
            row.forEach((value, col) => {
                expect(output[index]).toBeCloseTo(value, 4);
                expect(frames[0]?.entities.find((e) => e.id === `cell-${expected.indexOf(row)}-${col}`)).toBeDefined();
                index += 1;
            });
            const meanForRow = row.reduce((a, v) => a + v, 0) / row.length;
            expect(Math.abs(meanForRow)).toBeLessThan(1e-4);
        });
    });

    it("keeps samples independent of one another", () => {
        const small = { data: [[1, 2, 3]], gamma: 1, beta: 0, eps: 1e-5 };
        const shifted = { data: [[100, 200, 300]], gamma: 1, beta: 0, eps: 1e-5 };
        const a = [...mod.run(small)];
        const b = [...mod.run(shifted)];
        const outA = a[a.length - 1]?.meta["output"] as number[];
        const outB = b[b.length - 1]?.meta["output"] as number[];
        outA.forEach((value, i) => expect(value).toBeCloseTo(outB[i] ?? 0, 4));
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
