/**
 * qlora.test.ts - Finite-difference gradient check, quantization bound, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { dequantize4, loraGradient, loraLoss, quantize4 } from "./qlora";
import type { VisualFrame } from "@/types";

type Input = {
    W: number[][];
    x: number[];
    y: number[];
    A: number[][];
    B: number[][];
    lr: number;
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number")).toBe(true);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

function copyMatrix(M: number[][]): number[][] {
    return M.map((row) => row.slice());
}

describe("QLoRA teaching model", () => {
    it("matches central finite differences for every adapter gradient", () => {
        const input = mod.defaultInput as Input;
        const { codes, min, max } = quantize4(input.W);
        const Wq = dequantize4(codes, min, max);
        const grad = loraGradient(Wq, input.A, input.B, input.x, input.y);
        const eps = 1e-5;

        for (let i = 0; i < input.A.length; i += 1) {
            for (let j = 0; j < (input.A[i]?.length ?? 0); j += 1) {
                const plus = copyMatrix(input.A);
                const minus = copyMatrix(input.A);
                plus[i]![j]! += eps;
                minus[i]![j]! -= eps;
                const numeric = (loraLoss(Wq, plus, input.B, input.x, input.y) -
                    loraLoss(Wq, minus, input.B, input.x, input.y)) / (2 * eps);
                expect(grad.dA[i]?.[j] ?? 0).toBeCloseTo(numeric, 6);
            }
        }
        for (let i = 0; i < input.B.length; i += 1) {
            for (let j = 0; j < (input.B[i]?.length ?? 0); j += 1) {
                const plus = copyMatrix(input.B);
                const minus = copyMatrix(input.B);
                plus[i]![j]! += eps;
                minus[i]![j]! -= eps;
                const numeric = (loraLoss(Wq, input.A, plus, input.x, input.y) -
                    loraLoss(Wq, input.A, minus, input.x, input.y)) / (2 * eps);
                expect(grad.dB[i]?.[j] ?? 0).toBeCloseTo(numeric, 6);
            }
        }
    });

    it("lowers the loss after one gradient step", () => {
        const input = mod.defaultInput as Input;
        const meta = finalMeta(input);
        expect(meta["lossAfter"] as number).toBeLessThanOrEqual(meta["lossBefore"] as number);
        expect(meta["improved"]).toBe(true);
        const { codes, min, max } = quantize4(input.W);
        const range = max - min;
        dequantize4(codes, min, max).forEach((row, i) =>
            row.forEach((v, j) => expect(Math.abs(v - (input.W[i]?.[j] ?? 0))).toBeLessThanOrEqual(range / 30 + 1e-9)),
        );
        expect(codes.flat().every((c) => c >= 0 && c <= 15)).toBe(true);
    });

    it("keeps the low-rank update consistent across configurations", () => {
        const cases: Input[] = [
            { W: [[1, 2], [3, 4], [5, 6]], x: [0.5, -1], y: [0, 1, 2], A: [[0.2, 0.1]], B: [[0.1], [0.2], [-0.1]], lr: 0.02 },
            { W: [[-1, 0.5]], x: [2, 1], y: [-0.5], A: [[0.1, 0.2], [-0.1, 0.3]], B: [[0.2, -0.2]], lr: 0.01 },
        ];
        for (const input of cases) {
            const meta = finalMeta(input);
            expect(meta["lossAfter"] as number).toBeLessThanOrEqual(meta["lossBefore"] as number);
            expect(meta["pred"] as number[]).toHaveLength(input.y.length);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
