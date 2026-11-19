/**
 * polak-ribiere.test.ts - Reference cross-check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./polak-ribiere";
import type { VisualFrame } from "@/types";

interface Input {
    targetX: number;
    targetY: number;
    curvature: number;
    startX: number;
    startY: number;
    tol: number;
    maxIter: number;
}

/** Independent Polak-Ribiere Plus reference on the same diagonal quadratic. */
function reference(input: Input) {
    const { targetX: tx, targetY: ty, curvature: c, tol, maxIter } = input;
    let x = input.startX;
    let y = input.startY;
    const f = (u: number, v: number): number => (u - tx) ** 2 + c * (v - ty) ** 2;
    const g = (u: number, v: number): [number, number] => [2 * (u - tx), 2 * c * (v - ty)];
    let [gx, gy] = g(x, y);
    let dx = -gx;
    let dy = -gy;
    const objectives = [f(x, y)];
    let iterations = 0;
    for (let k = 1; k <= maxIter; k += 1) {
        if (Math.hypot(gx, gy) < tol) {
            break;
        }
        const denom = 2 * dx * dx + 2 * c * dy * dy;
        const alpha = -(gx * dx + gy * dy) / denom;
        x += alpha * dx;
        y += alpha * dy;
        const [ngx, ngy] = g(x, y);
        const raw = (ngx * (ngx - gx) + ngy * (ngy - gy)) / (gx * gx + gy * gy);
        const beta = Math.max(0, raw);
        dx = -ngx + beta * dx;
        dy = -ngy + beta * dy;
        gx = ngx;
        gy = ngy;
        objectives.push(f(x, y));
        iterations = k;
    }
    return { x, y, objective: f(x, y), iterations, objectives };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Polak-Ribiere Plus conjugate gradient", () => {
    it("matches an independent reference and reaches the known minimizer", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["x"])).toBeCloseTo(expected.x, 9);
        expect(Number(finalMeta?.["y"])).toBeCloseTo(expected.y, 9);
        expect(Number(finalMeta?.["objective"])).toBeCloseTo(expected.objective, 9);
        expect(finalMeta?.["converged"]).toBe(true);
        expect(expected.objective).toBeLessThan(1e-12);
        expect(expected.x).toBeCloseTo(input.targetX, 6);
        expect(expected.y).toBeCloseTo(input.targetY, 6);
    });

    it("reports a non-increasing objective across the replay", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const objectives = frames.map((frame) => Number(frame.meta["objective"]));
        for (let i = 1; i < objectives.length; i += 1) {
            expect(objectives[i] as number).toBeLessThanOrEqual((objectives[i - 1] as number) + 1e-12);
        }
    });

    it("handles a different starting point and target", () => {
        const input = { targetX: -1, targetY: 0, curvature: 5, startX: 2, startY: 3, tol: 1e-9, maxIter: 50 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["x"])).toBeCloseTo(-1, 6);
        expect(Number(finalMeta?.["y"])).toBeCloseTo(0, 6);
        expect(Number(finalMeta?.["objective"])).toBeLessThan(1e-10);
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
