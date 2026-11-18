/**
 * secant-method.test.ts - Independent secant reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./secant-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference using the same secant recurrence. */
function reference(a: number, b: number, iterations: number): number {
    let x0 = a;
    let x1 = b;
    const f = (x: number) => x * x - 2;
    for (let k = 0; k < iterations; k += 1) {
        const f0 = f(x0);
        const f1 = f(x1);
        if (f0 === f1) {
            break;
        }
        const next = x1 - (f1 * (x1 - x0)) / (f1 - f0);
        x0 = x1;
        x1 = next;
    }
    return x1;
}

describe("SecantMethod", () => {
    it("matches an independent reference from several starting pairs", () => {
        const starts: Array<[number, number]> = [
            [1, 2],
            [0.5, 3],
            [2, 1.5],
            [4, 3],
            [-1, -2],
        ];
        for (const [a, b] of starts) {
            const frames = [...mod.run({ a, b, iterations: 12 })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["root"])).toBeCloseTo(reference(a, b, 12), 10);
            const residual = Math.abs(Number(meta?.["root"]) ** 2 - 2);
            expect(residual).toBeLessThan(1e-8);
        }
    });

    it("converges to the positive square root of two for the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["root"])).toBeCloseTo(Math.SQRT2, 9);
        expect(Number(meta?.["error"])).toBeLessThan(1e-10);
        expect(meta?.["converged"]).toBe(true);
    });

    it("stops cleanly when the two function values coincide", () => {
        const frames = [...mod.run({ a: 1, b: 1, iterations: 8 })];
        checkFrames(frames);
        // Only the setup frame and the final report survive the early break.
        expect(frames.length).toBe(2);
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
