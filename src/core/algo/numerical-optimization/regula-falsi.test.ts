/**
 * regula-falsi.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./regula-falsi";
import type { VisualFrame } from "@/types";

function f(x: number): number {
    return x * x - 2;
}

/** Independent false-position reference. */
function reference(a0: number, b0: number, iterations: number): number {
    let a = a0;
    let b = b0;
    let xr = a;
    for (let i = 0; i < iterations; i += 1) {
        const fa = f(a);
        const fb = f(b);
        if (fa === fb) {
            break;
        }
        xr = (a * fb - b * fa) / (fb - fa);
        const fxr = f(xr);
        if (fa * fxr < 0) {
            b = xr;
        } else {
            a = xr;
        }
        if (Math.abs(fxr) < 1e-12) {
            break;
        }
    }
    return xr;
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

describe("Regula Falsi", () => {
    it("finds the square root of two and matches an independent replay", () => {
        const input = mod.defaultInput as { a: number; b: number; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const root = Number(last?.["root"]);
        expect(Math.abs(root - Math.SQRT2)).toBeLessThan(1e-6);
        expect(Math.abs(f(root))).toBeLessThan(1e-9);
        expect(Math.abs(root - reference(input.a, input.b, input.iterations))).toBeLessThan(1e-9);
    });

    it("keeps the bracket sign change in every intermediate frame", () => {
        const frames = [...mod.run({ a: 1, b: 2, iterations: 8 })];
        for (const frame of frames.slice(1, -1)) {
            const bars = frame.entities;
            const a = Number(bars[0]?.value);
            const b = Number(bars[2]?.value);
            expect(f(a) * f(b)).toBeLessThanOrEqual(0);
        }
    });

    it("stops early when the endpoints do not bracket a root", () => {
        const frames = [...mod.run({ a: 2, b: 3, iterations: 10 })];
        expect(frames.length).toBe(1);
        expect(frames[0]?.description).toContain("do not straddle");
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
