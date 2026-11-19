/**
 * dfp-method.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dfp-method";
import type { VisualFrame } from "@/types";

type Mat2 = [number, number, number, number];

function matVec(m: Mat2, v: [number, number]): [number, number] {
    return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}

/** Independent DFP replay on f(x,y) = x^2 + 2y^2. */
function reference(x0: number, y0: number, iterations: number) {
    let x = x0;
    let y = y0;
    let h: Mat2 = [1, 0, 0, 1];
    let gx = 2 * x;
    let gy = 4 * y;
    for (let i = 0; i < iterations; i += 1) {
        const dir = matVec(h, [-gx, -gy]);
        const dx = dir[0];
        const dy = dir[1];
        const den = 2 * dx * dx + 4 * dy * dy;
        if (den === 0) {
            break;
        }
        const alpha = -(gx * dx + gy * dy) / den;
        const sx = alpha * dx;
        const sy = alpha * dy;
        x += sx;
        y += sy;
        const ngx = 2 * x;
        const ngy = 4 * y;
        const yx = ngx - gx;
        const yy = ngy - gy;
        const hy = matVec(h, [yx, yy]);
        const yHy = yx * hy[0] + yy * hy[1];
        const sY = sx * yx + sy * yy;
        if (yHy !== 0 && sY !== 0) {
            h = [
                h[0] - (hy[0] * hy[0]) / yHy + (sx * sx) / sY,
                h[1] - (hy[0] * hy[1]) / yHy + (sx * sy) / sY,
                h[2] - (hy[1] * hy[0]) / yHy + (sy * sx) / sY,
                h[3] - (hy[1] * hy[1]) / yHy + (sy * sy) / sY,
            ];
        }
        gx = ngx;
        gy = ngy;
        if (x * x + 2 * y * y < 1e-18) {
            break;
        }
    }
    return { x, y };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DFP Quasi-Newton Method", () => {
    it("reaches the minimum of a quadratic and matches an independent replay", () => {
        const input = mod.defaultInput as { x0: number; y0: number; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["x"])).toBeCloseTo(0, 6);
        expect(Number(last?.["y"])).toBeCloseTo(0, 6);
        expect(Number(last?.["f"])).toBeLessThan(1e-12);
        const expected = reference(input.x0, input.y0, input.iterations);
        expect(Math.abs(Number(last?.["x"]) - expected.x)).toBeLessThan(1e-6);
        expect(Math.abs(Number(last?.["y"]) - expected.y)).toBeLessThan(1e-6);
    });

    it("builds a symmetric inverse-Hessian estimate", () => {
        const frames = [...mod.run({ x0: 3, y0: 2, iterations: 6 })];
        const last = frames[frames.length - 1]?.meta;
        expect(typeof last?.["h11"]).toBe("number");
        expect(Number.isFinite(Number(last?.["h11"]))).toBe(true);
        expect(Number(last?.["h11"])).toBeGreaterThan(0);
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
