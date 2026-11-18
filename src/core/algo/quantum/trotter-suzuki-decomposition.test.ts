/**
 * trotter-suzuki-decomposition.test.ts - Independent matrix cross-check of the
 * one-slice error and measured convergence rates, plus frame-shape and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./trotter-suzuki-decomposition";
import type { VisualFrame } from "@/types";

type C = [number, number];
type M = [[C, C], [C, C]];

const mul = (x: C, y: C): C => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
const mm = (a: M, b: M): M => [
    [
        [mul(a[0][0], b[0][0])[0] + mul(a[0][1], b[1][0])[0], mul(a[0][0], b[0][0])[1] + mul(a[0][1], b[1][0])[1]],
        [mul(a[0][0], b[0][1])[0] + mul(a[0][1], b[1][1])[0], mul(a[0][0], b[0][1])[1] + mul(a[0][1], b[1][1])[1]],
    ],
    [
        [mul(a[1][0], b[0][0])[0] + mul(a[1][1], b[1][0])[0], mul(a[1][0], b[0][0])[1] + mul(a[1][1], b[1][0])[1]],
        [mul(a[1][0], b[0][1])[0] + mul(a[1][1], b[1][1])[0], mul(a[1][0], b[0][1])[1] + mul(a[1][1], b[1][1])[1]],
    ],
];

function expX(angle: number): M {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [[[c, 0], [0, -s]], [[0, -s], [c, 0]]];
}

function expZ(angle: number): M {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [[[c, -s], [0, 0]], [[0, 0], [c, s]]];
}

function exact(a: number, b: number, t: number): M {
    const h = Math.hypot(a, b) || 1;
    const c = Math.cos(h * t);
    const s = Math.sin(h * t) / h;
    return [[[c, -s * b], [0, -s * a]], [[0, -s * a], [c, s * b]]];
}

function error(a: M, b: M): number {
    let worst = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            worst = Math.max(worst, Math.hypot(a[i][j][0] - b[i][j][0], a[i][j][1] - b[i][j][1]));
        }
    }
    return worst;
}

function checkFrames(frames: VisualFrame[], sliceCount: number): void {
    expect(frames.length).toBe(sliceCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(sliceCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Trotter-Suzuki Decomposition", () => {
    it("matches an independent one-slice error calculation", () => {
        const input = mod.defaultInput as { a: number; b: number; time: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 5);
        const errors = frames[frames.length - 1]?.meta["errors"] as number[];
        const expected = error(mm(expX(input.a * input.time), expZ(input.b * input.time)), exact(input.a, input.b, input.time));
        expect(errors[0]).toBeCloseTo(expected, 9);
    });

    it("decreases error with more slices and shows the expected convergence rate", () => {
        const first = [...mod.run(mod.defaultInput)].at(-1)?.meta;
        const errors = first?.["errors"] as number[];
        for (let i = 1; i < errors.length; i += 1) {
            expect(errors[i]!).toBeLessThanOrEqual(errors[i - 1]!);
        }
        const firstOrderRatio = errors[1]! / errors[3]!;
        expect(firstOrderRatio).toBeGreaterThan(3.2);
        expect(firstOrderRatio).toBeLessThan(5);

        const second = [...mod.run({ ...(mod.defaultInput as object), order: 2 })].at(-1)?.meta;
        const secondErrors = second?.["errors"] as number[];
        const secondOrderRatio = secondErrors[1]! / secondErrors[3]!;
        expect(secondOrderRatio).toBeGreaterThan(10);
        expect(secondOrderRatio).toBeLessThan(25);
        expect(secondErrors[4]!).toBeLessThan(errors[4]!);
    });

    it("has zero error when both Hamiltonians vanish", () => {
        const meta = [...mod.run({ a: 0, b: 0, time: 1, slices: [1, 2, 4] })].at(-1)?.meta;
        expect(meta?.["errors"]).toEqual([0, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
