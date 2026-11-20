/**
 * broydens-method.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./broydens-method";
import type { VisualFrame } from "@/types";

type Mat2 = [number, number, number, number];
const A: Mat2 = [1, 2, 3, -1];
const B: [number, number] = [3, 1];

function residual(x: number, y: number): [number, number] {
    return [A[0] * x + A[1] * y - B[0], A[2] * x + A[3] * y - B[1]];
}

function solve2(m: Mat2, rhs: [number, number]): [number, number] {
    const det = m[0] * m[3] - m[1] * m[2];
    return [
        (rhs[0] * m[3] - m[1] * rhs[1]) / det,
        (m[0] * rhs[1] - rhs[0] * m[2]) / det,
    ];
}

/** Independent good-Broyden replay of the same linear system. */
function reference(x0: number, y0: number, iterations: number) {
    let x = x0;
    let y = y0;
    let j: Mat2 = [1, 0, 0, 1];
    let r = residual(x, y);
    for (let i = 0; i < iterations; i += 1) {
        const s = solve2(j, [-r[0], -r[1]]);
        x += s[0];
        y += s[1];
        const nr = residual(x, y);
        const den = s[0] * s[0] + s[1] * s[1];
        if (den !== 0) {
            j = [
                j[0] + (nr[0] * s[0]) / den,
                j[1] + (nr[0] * s[1]) / den,
                j[2] + (nr[1] * s[0]) / den,
                j[3] + (nr[1] * s[1]) / den,
            ];
        }
        r = nr;
        if (Math.hypot(r[0], r[1]) < 1e-10) {
            break;
        }
    }
    return { x, y, residual: Math.hypot(r[0], r[1]) };
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

describe("Broyden's Method", () => {
    it("solves the system and matches an independent replay", () => {
        const input = mod.defaultInput as { x0: number; y0: number; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.x0, input.y0, input.iterations);
        const last = frames[frames.length - 1]?.meta;
        expect(Math.abs(Number(last?.["x"]) - expected.x)).toBeLessThan(1e-6);
        expect(Math.abs(Number(last?.["y"]) - expected.y)).toBeLessThan(1e-6);
        expect(Number(last?.["residual"])).toBeLessThan(1e-6);
    });

    it("converges to the exact linear solution", () => {
        const frames = [...mod.run({ x0: 0, y0: 0, iterations: 12 })];
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["x"])).toBeCloseTo(5 / 7, 6);
        expect(Number(last?.["y"])).toBeCloseTo(8 / 7, 6);
        const r = residual(Number(last?.["x"]), Number(last?.["y"]));
        expect(Math.hypot(r[0], r[1])).toBeLessThan(1e-6);
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
