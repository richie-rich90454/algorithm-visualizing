/**
 * stouffer-method.test.ts - Independent inverse-normal via numerical
 * integration, symmetry, weighting, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./stouffer-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBe(k + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(k);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

/** CDF by Simpson integration of the standard normal density, independent of the module. */
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

function refInv(upperTail: number): number {
    const target = 1 - upperTail;
    let low = -10;
    let high = 10;
    for (let i = 0; i < 80; i += 1) {
        const mid = (low + high) / 2;
        if (refPhi(mid) < target) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}

function reference(pValues: number[], weights: number[]): number {
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < pValues.length; i += 1) {
        sum += refInv(pValues[i]) * weights[i];
        sq += weights[i] * weights[i];
    }
    return sum / Math.sqrt(sq);
}

describe("StoufferMethod", () => {
    it("matches an inverse normal computed by numerical integration", () => {
        const pValues = [0.03, 0.2, 0.005];
        const frames = [...mod.run({ pValues })];
        checkFrames(frames, pValues.length);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["Z"])).toBeCloseTo(reference(pValues, [1, 1, 1]), 3);
    });

    it("respects weights", () => {
        const pValues = [0.01, 0.4];
        const weighted = [...mod.run({ pValues, weights: [3, 1] })].at(-1);
        const unweighted = [...mod.run({ pValues, weights: [1, 1] })].at(-1);
        expect(Number(weighted?.meta["Z"])).toBeCloseTo(reference(pValues, [3, 1]), 3);
        expect(Number(weighted?.meta["Z"])).not.toBeCloseTo(Number(unweighted?.meta["Z"]), 1);
    });

    it("a null p value gives zero and reversal negates the score", () => {
        const zNull = Number([...mod.run({ pValues: [0.5, 0.5] })].at(-1)?.meta["Z"]);
        expect(zNull).toBeCloseTo(0, 10);
        const z1 = Number([...mod.run({ pValues: [0.1, 0.3] })].at(-1)?.meta["Z"]);
        const z2 = Number([...mod.run({ pValues: [0.9, 0.7] })].at(-1)?.meta["Z"]);
        expect(z2).toBeCloseTo(-z1, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
