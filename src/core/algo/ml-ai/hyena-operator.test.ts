/**
 * hyena-operator.test.ts - Brute-force convolution reference, identity-filter
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hyena-operator";
import type { VisualFrame } from "@/types";

function conv(x: number[], h: number[]): number[] {
    return x.map((_value, t) => {
        let sum = 0;
        for (let s = 0; s <= t; s += 1) sum += (x[s] ?? 0) * (h[t - s] ?? 0);
        return sum;
    });
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

describe("HyenaOperator", () => {
    it("matches a brute-force order-two recurrence on several inputs", () => {
        const cases = [
            { x: [1, 2, 3, 1], h1: [0.5, 0.25, 0.125, 0.0625], h2: [0.25, 0.5, 0.25, 0.125] },
            { x: [2, -1, 3], h1: [0.2, 0.3], h2: [1, 0.5, 0.25] },
            { x: [1, 1, 1, 1, 1], h1: [1, 0, 0, 0, 0], h2: [0.5, 0.5] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.x.length);
            const first = conv(testCase.x, testCase.h1);
            const gated = testCase.x.map((v, t) => v * (first[t] ?? 0));
            const output = conv(gated, testCase.h2);
            const final = frames[frames.length - 1];
            (final?.meta["first"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(first[i] ?? 0, 9));
            (final?.meta["gated"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(gated[i] ?? 0, 9));
            (final?.meta["output"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(output[i] ?? 0, 9));
        }
    });

    it("returns the gated signal when the second filter is the identity", () => {
        const x = [1, 2, 3, 4];
        const h1 = [0.5, 0.25];
        const h2 = [1, 0, 0, 0];
        const frames = [...mod.run({ x, h1, h2 })];
        const final = frames[frames.length - 1];
        const gated = final?.meta["gated"] as number[];
        const output = final?.meta["output"] as number[];
        output.forEach((v, i) => expect(v).toBeCloseTo(gated[i] ?? 0, 9));
    });

    it("uses only causal terms: changing a later input leaves earlier outputs fixed", () => {
        const prefix = [...mod.run({ x: [1, 2, 3], h1: [0.5, 0.25], h2: [0.5, 0.25] })];
        const extended = [...mod.run({ x: [1, 2, 3, 99], h1: [0.5, 0.25], h2: [0.5, 0.25] })];
        const p = prefix[prefix.length - 1]?.meta["output"] as number[];
        const e = extended[extended.length - 1]?.meta["output"] as number[];
        for (let i = 0; i < p.length; i += 1) expect(e[i]).toBeCloseTo(p[i] ?? 0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
