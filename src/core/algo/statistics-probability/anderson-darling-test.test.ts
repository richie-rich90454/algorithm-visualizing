/**
 * anderson-darling-test.test.ts - Independent statistic via numerical
 * integration of the normal curve, nonnegativity, constant-sample case,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./anderson-darling-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
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

function refPhi(z: number): number {
    const f = (t: number): number => Math.exp((-t * t) / 2) / Math.sqrt(2 * Math.PI);
    const a = -14;
    const n = 4000;
    const h = (z - a) / n;
    let sum = f(a) + f(z);
    for (let i = 1; i < n; i += 1) {
        sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
    }
    return sum * (h / 3);
}

function reference(sample: number[]): number {
    const n = sample.length;
    if (n < 2) {
        return 0;
    }
    const sorted = [...sample].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    let ss = 0;
    for (const v of sorted) {
        ss += (v - mean) ** 2;
    }
    const sd = Math.sqrt(ss / (n - 1));
    if (sd === 0) {
        return 0;
    }
    let weighted = 0;
    for (let i = 0; i < n; i += 1) {
        const zLow = (sorted[i] - mean) / sd;
        const zHigh = (sorted[n - 1 - i] - mean) / sd;
        const low = Math.min(1 - 1e-12, Math.max(1e-12, refPhi(zLow)));
        const high = Math.min(1 - 1e-12, Math.max(1e-12, 1 - refPhi(zHigh)));
        weighted += (2 * (i + 1) - 1) * (Math.log(low) + Math.log(high));
    }
    return Math.max(0, -n - weighted / n);
}

describe("AndersonDarlingTest", () => {
    it("matches an independent statistic computed by numerical integration", () => {
        const sample = [1.2, -0.4, 0.7, 2.3, -1.1, 0.2, 0.9, -0.7];
        const frames = [...mod.run({ sample })];
        checkFrames(frames, sample.length);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["statistic"])).toBeCloseTo(reference(sample), 3);
        expect(Number(final.meta["statistic"])).toBeGreaterThanOrEqual(0);
    });

    it("gives zero for a constant sample", () => {
        const final = [...mod.run({ sample: [2, 2, 2, 2, 2] })].at(-1);
        expect(Number(final?.meta["statistic"])).toBeCloseTo(0, 12);
    });

    it("grows for a strongly non-normal sample", () => {
        const normal = [...mod.run({ sample: [0, 0.5, 1, 1.5, 2] })].at(-1);
        const extreme = [...mod.run({ sample: [0, 0, 0, 0, 10] })].at(-1);
        expect(Number(extreme?.meta["statistic"])).toBeGreaterThan(Number(normal?.meta["statistic"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
