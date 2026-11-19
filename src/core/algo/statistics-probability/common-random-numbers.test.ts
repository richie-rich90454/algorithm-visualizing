/**
 * common-random-numbers.test.ts - Reference variance/covariance checks,
 * variance-reduction property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./common-random-numbers";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function variance(values: number[]): number {
    const n = values.length;
    if (n < 2) {
        return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / n;
    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
}

function covariance(xs: number[], ys: number[]): number {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let acc = 0;
    for (let i = 0; i < n; i += 1) {
        acc += (xs[i]! - mx) * (ys[i]! - my);
    }
    return acc / (n - 1);
}

describe("CommonRandomNumbers", () => {
    it("matches independently computed means, variances, and covariance", () => {
        const input = mod.defaultInput as { uniforms: number[]; scaleA: number; scaleB: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.uniforms.length);
        const meta = frames[frames.length - 1]!.meta;
        const a = input.uniforms.map((u) => -input.scaleA * Math.log(1 - u));
        const b = input.uniforms.map((u) => -input.scaleB * Math.log(1 - u));
        const paired = a.map((v, i) => v - b[i]!);
        const rev = [...b].reverse();
        const unpaired = a.map((v, i) => v - rev[i]!);
        const refMean = paired.reduce((x, y) => x + y, 0) / paired.length;
        expect(meta["a"]).toEqual(a);
        expect(meta["b"]).toEqual(b);
        expect(meta["pairedMean"]).toBeCloseTo(refMean, 10);
        expect(meta["pairedVar"]).toBeCloseTo(variance(paired), 10);
        expect(meta["unpairedVar"]).toBeCloseTo(variance(unpaired), 10);
        expect(meta["covariance"]).toBeCloseTo(covariance(a, b), 10);
    });

    it("always lowers paired variance for monotone transforms", () => {
        for (const [scaleA, scaleB] of [[2, 1], [3, 0.5], [1.5, 1.4]] as Array<[number, number]>) {
            const frames = [...mod.run({ uniforms: [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95], scaleA, scaleB })];
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["pairedVar"] as number).toBeLessThanOrEqual(meta["unpairedVar"] as number);
            expect(meta["covariance"] as number).toBeGreaterThan(0);
            const identity = (meta["pairedVar"] as number) + 2 * (meta["covariance"] as number);
            expect(identity).toBeCloseTo(
                variance(meta["a"] as number[]) + variance(meta["b"] as number[]),
                10,
            );
        }
    });

    it("keeps both estimators centered on the same mean", () => {
        const meta = [...mod.run(mod.defaultInput)].pop()!.meta;
        expect(meta["pairedMean"]).toBeCloseTo(meta["unpairedMean"] as number, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { uniforms: number[] }).uniforms.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
