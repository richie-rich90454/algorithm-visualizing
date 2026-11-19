/**
 * fletcher-reeves.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fletcher-reeves";
import type { VisualFrame } from "@/types";

/** Independent Fletcher-Reeves replay on f(x,y) = x^2 + 2y^2. */
function reference(x0: number, y0: number, iterations: number) {
    let x = x0;
    let y = y0;
    let gx = 2 * x;
    let gy = 4 * y;
    let dx = -gx;
    let dy = -gy;
    for (let i = 0; i < iterations; i += 1) {
        const den = 2 * dx * dx + 4 * dy * dy;
        if (den === 0) {
            break;
        }
        const alpha = -(gx * dx + gy * dy) / den;
        x += alpha * dx;
        y += alpha * dy;
        const ngx = 2 * x;
        const ngy = 4 * y;
        const old = gx * gx + gy * gy;
        const beta = old === 0 ? 0 : (ngx * ngx + ngy * ngy) / old;
        if (x * x + 2 * y * y < 1e-18) {
            break;
        }
        dx = -ngx + beta * dx;
        dy = -ngy + beta * dy;
        gx = ngx;
        gy = ngy;
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

describe("Fletcher-Reeves Conjugate Gradient", () => {
    it("minimizes a quadratic and matches an independent replay", () => {
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

    it("never increases the objective from one frame to the next", () => {
        const frames = [...mod.run({ x0: 3, y0: 4, iterations: 6 })];
        const values = frames.map((frame) => Number(frame.meta["f"]));
        for (let i = 1; i < values.length; i += 1) {
            expect(values[i]).toBeLessThanOrEqual((values[i - 1] as number) + 1e-12);
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
