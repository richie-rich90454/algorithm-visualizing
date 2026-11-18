/** kl-divergence.test.ts - Independent cross-checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./kl-divergence";
import type { VisualFrame } from "@/types";

/** Brute-force definition of KL divergence with the 0 log 0 = 0 convention. */
function reference(p: number[], q: number[]): number {
    let total = 0;
    for (let i = 0; i < p.length; i += 1) {
        const pi = p[i] ?? 0;
        const qi = q[i] ?? 0;
        if (pi === 0) continue;
        if (qi === 0) return Number.POSITIVE_INFINITY;
        total += pi * Math.log(pi / qi);
    }
    return total;
}

function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomDistribution(k: number, rng: () => number): number[] {
    const raw = Array.from({ length: k }, () => rng() + 0.05);
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((x) => x / sum);
}

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3 * k);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("KL Divergence", () => {
    it("matches the brute-force definition on the default and hand cases", () => {
        const cases: Array<{ p: number[]; q: number[] }> = [
            { p: [0.5, 0.25, 0.25], q: [1 / 3, 1 / 3, 1 / 3] },
            { p: [0.5, 0.5], q: [0.25, 0.75] },
            { p: [0.2, 0.3, 0.5], q: [0.2, 0.3, 0.5] },
            { p: [0.7, 0.3], q: [0, 1] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.p.length);
            const final = Number(frames[frames.length - 1]?.meta["divergence"]);
            const expected = reference(testCase.p, testCase.q);
            if (Number.isFinite(expected)) {
                expect(final).toBeCloseTo(expected, 10);
            } else {
                expect(Number.isFinite(final)).toBe(false);
            }
        }
    });

    it("is zero on identical distributions and nonnegative on random pairs", () => {
        const rng = makeRng(12345);
        for (let trial = 0; trial < 30; trial += 1) {
            const p = randomDistribution(5, rng);
            const q = randomDistribution(5, rng);
            const same = [...mod.run({ p, q: [...p] })];
            expect(Number(same[same.length - 1]?.meta["divergence"])).toBeCloseTo(0, 10);
            const diff = [...mod.run({ p, q })];
            const value = Number(diff[diff.length - 1]?.meta["divergence"]);
            expect(value).toBeGreaterThanOrEqual(-1e-12);
        }
    });

    it("obeys divergence equals cross-entropy minus entropy and is asymmetric", () => {
        const p = [0.1, 0.2, 0.3, 0.4];
        const q = [0.4, 0.4, 0.1, 0.1];
        const meta = [...mod.run({ p, q })].at(-1)?.meta;
        const d = Number(meta?.["divergence"]);
        const h = Number(meta?.["entropyP"]);
        const ce = Number(meta?.["crossEntropy"]);
        expect(d).toBeCloseTo(ce - h, 10);
        const reverse = Number([...mod.run({ p: q, q: p })].at(-1)?.meta["divergence"]);
        expect(Math.abs(d - reverse)).toBeGreaterThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
