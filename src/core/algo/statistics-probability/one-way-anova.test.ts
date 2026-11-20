/**
 * one-way-anova.test.ts - Independent variance decomposition, sum-of-squares
 * identity, p-value ordering, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./one-way-anova";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBe(k + 5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(k);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Brute-force variance decomposition from raw data. */
function reference(groups: number[][]) {
    const means = groups.map((group) => group.reduce((a, b) => a + b, 0) / group.length);
    const totalN = groups.reduce((sum, group) => sum + group.length, 0);
    const grand = groups.reduce((sum, group) => sum + group.reduce((a, b) => a + b, 0), 0) / totalN;
    let ssb = 0;
    let ssw = 0;
    let sst = 0;
    for (let i = 0; i < groups.length; i += 1) {
        for (const value of groups[i]!) {
            ssw += (value - means[i]!) ** 2;
            sst += (value - grand) ** 2;
        }
        ssb += groups[i]!.length * (means[i]! - grand) ** 2;
    }
    const dfBetween = groups.length - 1;
    const dfWithin = totalN - groups.length;
    const f = (ssb / dfBetween) / (ssw / dfWithin);
    return { means, grand, ssb, ssw, sst, f };
}

describe("one-way ANOVA", () => {
    it("matches an independent variance decomposition", () => {
        const groups = (mod.defaultInput as { groups: number[][] }).groups;
        const frames = [...mod.run({ groups })];
        checkFrames(frames, groups.length);
        const want = reference(groups);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["groupMeans"]).toEqual(want.means);
        expect(Number(last?.["grandMean"])).toBeCloseTo(want.grand, 12);
        expect(Number(last?.["ssBetween"])).toBeCloseTo(want.ssb, 12);
        expect(Number(last?.["ssWithin"])).toBeCloseTo(want.ssw, 12);
        expect(Number(last?.["ssTotal"])).toBeCloseTo(want.sst, 12);
        expect(Number(last?.["f"])).toBeCloseTo(want.f, 12);
    });

    it("preserves the sum-of-squares identity and degrees of freedom", () => {
        const cases: number[][][] = [
            [[1, 2, 3], [2, 3, 4], [3, 4, 5]],
            [[1, 2, 3], [10, 11, 12], [20, 21, 22]],
            [[5, 5, 5, 5], [5, 5, 5, 5], [9, 9, 9, 9]],
        ];
        for (const groups of cases) {
            const frames = [...mod.run({ groups })];
            checkFrames(frames, groups.length);
            const meta = frames[frames.length - 1]?.meta;
            const ssb = Number(meta?.["ssBetween"]);
            const ssw = Number(meta?.["ssWithin"]);
            const sst = Number(meta?.["ssTotal"]);
            expect(ssb + ssw).toBeCloseTo(sst, 9);
            expect(Number(meta?.["dfBetween"]) + Number(meta?.["dfWithin"])).toBe(Number(meta?.["totalN"]) - 1);
            const p = Number(meta?.["pValue"]);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        }
    });

    it("gives a smaller p value for stronger group separation", () => {
        const weak = [...mod.run({ groups: [[1, 2, 3], [2, 3, 4], [3, 4, 5]] })];
        const strong = [...mod.run({ groups: [[1, 2, 3], [10, 11, 12], [20, 21, 22]] })];
        const weakP = Number(weak[weak.length - 1]?.meta["pValue"]);
        const strongP = Number(strong[strong.length - 1]?.meta["pValue"]);
        expect(strongP).toBeLessThan(weakP);
        expect(strongP).toBeLessThan(0.05);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(groupsLength(mod.defaultInput));
        expect(generator.next().done).toBe(true);
    });
});

function groupsLength(input: unknown): number {
    const groups = (input as { groups: number[][] }).groups;
    return groups.length + 5;
}
