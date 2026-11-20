/**
 * empirical-bayes.test.ts - Independent moment calculations, shrinkage
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./empirical-bayes";
import type { VisualFrame } from "@/types";

interface Group {
    y: number;
    variance: number;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference DerSimonian-Laird computation using explicit loops. */
function reference(groups: Group[]) {
    const j = groups.length;
    const w = groups.map((g) => 1 / g.variance);
    const sumW = w.reduce((a, b) => a + b, 0);
    let ybar = 0;
    for (let i = 0; i < j; i += 1) {
        ybar += (w[i]! * groups[i]!.y) / sumW;
    }
    let q = 0;
    for (let i = 0; i < j; i += 1) {
        q += (groups[i]!.y - ybar) ** 2 / groups[i]!.variance;
    }
    let sumW2 = 0;
    for (let i = 0; i < j; i += 1) {
        sumW2 += w[i]! * w[i]!;
    }
    const denom = sumW - sumW2 / sumW;
    const tau2 = denom > 0 ? Math.max(0, (q - (j - 1)) / denom) : 0;
    const wt = groups.map((g) => 1 / (g.variance + tau2));
    const sumWt = wt.reduce((a, b) => a + b, 0);
    let mu = 0;
    for (let i = 0; i < j; i += 1) {
        mu += (wt[i]! * groups[i]!.y) / sumWt;
    }
    const shrunk = groups.map((g) => mu + (tau2 / (tau2 + g.variance)) * (g.y - mu));
    return { mu, tau2, shrunk };
}

describe("EmpiricalBayes", () => {
    it("matches an independent moment reference", () => {
        const input = mod.defaultInput as { groups: Group[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.groups.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.groups);
        expect(meta["mu"]).toBeCloseTo(expected.mu, 10);
        expect(meta["tau2"]).toBeCloseTo(expected.tau2, 10);
        const shrunk = meta["shrunk"] as number[];
        for (let i = 0; i < shrunk.length; i += 1) {
            expect(shrunk[i]).toBeCloseTo(expected.shrunk[i]!, 10);
        }
    });

    it("keeps shrink factors in range and never over-shrinks when tau is zero", () => {
        for (const groups of [
            [{ y: 10, variance: 4 }, { y: 12, variance: 4 }, { y: 14, variance: 4 }],
            [{ y: 1, variance: 100 }, { y: 2, variance: 100 }, { y: 3, variance: 100 }],
            [{ y: 5, variance: 1 }, { y: 50, variance: 1 }],
        ] as Group[][]) {
            const frames = [...mod.run({ groups })];
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["tau2"] as number).toBeGreaterThanOrEqual(0);
            const bFactors = meta["bFactors"] as number[];
            expect(bFactors.every((b) => b >= -1e-12 && b <= 1 + 1e-12)).toBe(true);
            const mu = meta["mu"] as number;
            const shrunk = meta["shrunk"] as number[];
            for (let i = 0; i < groups.length; i += 1) {
                const lo = Math.min(groups[i]!.y, mu);
                const hi = Math.max(groups[i]!.y, mu);
                expect(shrunk[i]!).toBeGreaterThanOrEqual(lo - 1e-9);
                expect(shrunk[i]!).toBeLessThanOrEqual(hi + 1e-9);
            }
        }
    });

    it("clamps negative moment estimates of tau squared to zero", () => {
        const frames = [...mod.run({ groups: [{ y: 5, variance: 1 }, { y: 5, variance: 1 }] })];
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["tau2"]).toBe(0);
        expect(meta["shrunk"]).toEqual([5, 5]);
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ groups: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { groups: Group[] }).groups.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
