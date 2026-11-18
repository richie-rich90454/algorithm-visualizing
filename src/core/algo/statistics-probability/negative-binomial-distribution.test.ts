/**
 * negative-binomial-distribution.test.ts - Brute-force PMF cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./negative-binomial-distribution";
import type { VisualFrame } from "@/types";

/** Independent PMF via the stable ratio pmf(k+1) = pmf(k) * (k+r)/(k+1) * (1-p). */
function refPmf(k: number, r: number, p: number): number {
    let value = Math.pow(p, r);
    for (let i = 0; i < k; i += 1) {
        value = value * ((i + r) / (i + 1)) * (1 - p);
    }
    return value;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Negative binomial distribution", () => {
    it("matches a brute-force PMF and cumulative table", () => {
        for (const [r, p] of [
            [2, 0.5],
            [1, 0.3],
            [3, 0.7],
            [4, 0.25],
        ]) {
            const kMax = 12;
            const frames = [...mod.run({ r, p, maxK: kMax })];
            checkFrames(frames, kMax + 1);
            const cdf = frames[frames.length - 1]?.meta["cdf"] as number[];
            let running = 0;
            for (let k = 0; k <= kMax; k += 1) {
                running += refPmf(k, r, p);
                expect(cdf[k]).toBeCloseTo(running, 9);
            }
            expect(cdf[cdf.length - 1] ?? 0).toBeGreaterThan(cdf[0] ?? 0);
            expect(cdf[cdf.length - 1] ?? 0).toBeLessThan(1);
        }
    });

    it("reports the exact mean and variance from direct summation", () => {
        const r = 3;
        const p = 0.4;
        const kMax = 200;
        const frames = [...mod.run({ r, p, maxK: 40 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["mean"])).toBeCloseTo((r * (1 - p)) / p, 9);
        expect(Number(meta?.["variance"])).toBeCloseTo((r * (1 - p)) / (p * p), 9);

        let sumP = 0;
        let sumKP = 0;
        let sumK2P = 0;
        for (let k = 0; k <= kMax; k += 1) {
            const mass = refPmf(k, r, p);
            sumP += mass;
            sumKP += k * mass;
            sumK2P += k * k * mass;
        }
        const directMean = sumKP / sumP;
        const directVar = sumK2P / sumP - directMean * directMean;
        expect(Number(meta?.["mean"])).toBeCloseTo(directMean, 5);
        expect(Number(meta?.["variance"])).toBeCloseTo(directVar, 3);
    });

    it("has a monotone cumulative distribution", () => {
        const frames = [...mod.run({ r: 2, p: 0.5, maxK: 10 })];
        const cdf = frames[0]?.meta["cdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] ?? 0).toBeGreaterThanOrEqual(cdf[i - 1] ?? 0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(13);
        expect(generator.next().done).toBe(true);
    });
});
