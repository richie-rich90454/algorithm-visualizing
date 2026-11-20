/**
 * mcnemar-test.test.ts - Independent statistic and exact binomial tail,
 * symmetry, known p value, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mcnemar-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(b: number, c: number): { statistic: number; pValue: number } {
    const n = b + c;
    if (n === 0) {
        return { statistic: 0, pValue: 1 };
    }
    const statistic = Math.max(0, Math.abs(b - c) - 1) ** 2 / n;
    const choose = (k: number): number => {
        let value = 1;
        for (let i = 1; i <= k; i += 1) {
            value = (value * (n - i + 1)) / i;
        }
        return value;
    };
    let sum = 0;
    for (let i = 0; i <= Math.min(b, c); i += 1) {
        sum += choose(i) / 2 ** n;
    }
    return { statistic, pValue: Math.min(1, 2 * sum) };
}

describe("McNemarTest", () => {
    it("matches an independent statistic and binomial tail", () => {
        const b = 12;
        const c = 3;
        const frames = [...mod.run({ b, c })];
        checkFrames(frames, b + c);
        const expected = reference(b, c);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["statistic"])).toBeCloseTo(expected.statistic, 12);
        expect(Number(final.meta["pValue"])).toBeCloseTo(expected.pValue, 12);
    });

    it("reproduces the textbook example", () => {
        const final = [...mod.run({ b: 12, c: 3 })].at(-1);
        expect(Number(final?.meta["statistic"])).toBeCloseTo(4.2667, 3);
        expect(Number(final?.meta["pValue"])).toBeCloseTo(0.0352, 3);
    });

    it("is symmetric in b and c and returns one for balanced counts", () => {
        const p1 = Number([...mod.run({ b: 9, c: 2 })].at(-1)?.meta["pValue"]);
        const p2 = Number([...mod.run({ b: 2, c: 9 })].at(-1)?.meta["pValue"]);
        expect(p2).toBeCloseTo(p1, 12);
        const balanced = [...mod.run({ b: 5, c: 5 })].at(-1);
        expect(Number(balanced?.meta["statistic"])).toBeCloseTo(0, 12);
        expect(Number(balanced?.meta["pValue"])).toBeCloseTo(1, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(19);
        expect(generator.next().done).toBe(true);
    });
});
