/** physics-informed-neural-network.test.ts - Brute-force residual check, exact-solution property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { pinnLoss, pinnResidual } from "./physics-informed-neural-network";
import type { VisualFrame } from "@/types";

interface Input {
    u: number[];
    f: number[];
    h: number;
    bcLeft: number;
    bcRight: number;
    residualWeight: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Physics-informed neural network", () => {
    it("residual matches an independent finite-difference computation", () => {
        const u = [0, 0.3, 0.9, 1.7, 2.1];
        const f = [1, 2, 3, 4, 5];
        const h = 0.2;
        const got = pinnResidual(u, f, h);
        for (let i = 1; i < u.length - 1; i += 1) {
            const expected = (u[i + 1]! - 2 * u[i]! + u[i - 1]!) / (h * h) - f[i]!;
            expect(close(got[i]!, expected)).toBe(true);
        }
        expect(got[0]).toBe(0);
        expect(got[got.length - 1]).toBe(0);
    });

    it("an exact discrete solution gives zero total loss", () => {
        const u = [0, 0.0625, 0.25, 0.5625, 1];
        const f = [2, 2, 2, 2, 2];
        const { total, dataLoss, residualLoss } = pinnLoss(u, f, 0.25, 0, 1, 1);
        expect(close(dataLoss, 0)).toBe(true);
        expect(close(residualLoss, 0)).toBe(true);
        expect(close(total, 0)).toBe(true);
    });

    it("boundary error and residual weight combine linearly", () => {
        const u = [0.5, 1, 1.5, 2];
        const f = [0, 0, 0, 0];
        const a = pinnLoss(u, f, 1, 0, 0, 1);
        const b = pinnLoss(u, f, 1, 0, 0, 3);
        expect(close(a.total, a.dataLoss + a.residualLoss)).toBe(true);
        expect(close(b.total, b.dataLoss + 3 * b.residualLoss)).toBe(true);
        expect(a.total).toBeGreaterThan(0);
    });

    it("handles short grids and zero spacing without NaN", () => {
        expect(pinnResidual([1], [0], 1)).toEqual([0]);
        expect(pinnResidual([1, 2], [0, 0], 0)).toEqual([0, 0]);
        expect(Number.isFinite(pinnLoss([1, 2], [0, 0], 0, 0, 0, 1).total)).toBe(true);
    });

    it("matches the loss and residual through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = pinnLoss(input.u, input.f, input.h, input.bcLeft, input.bcRight, input.residualWeight);
        const final = frames[frames.length - 1]?.meta;
        expect(close(final?.["total"] as number, expected.total)).toBe(true);
        expect(close(final?.["dataLoss"] as number, expected.dataLoss)).toBe(true);
        const residual = final?.["residual"] as number[];
        residual.forEach((v, i) => expect(close(v, expected.residual[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
