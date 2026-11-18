import { describe, expect, it } from "vitest";
import mod from "./kruskal-wallis-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent brute-force computation of the tie-corrected H statistic. */
function reference(groups: number[][]) {
    const pooled = groups.flatMap((group, g) => group.map((value) => ({ value, g })));
    pooled.sort((a, b) => a.value - b.value);
    const rankSums = groups.map(() => 0);
    let tieTerm = 0;
    let i = 0;
    while (i < pooled.length) {
        let j = i + 1;
        while (j < pooled.length && pooled[j]!.value === pooled[i]!.value) {
            j += 1;
        }
        const rank = (i + 1 + j) / 2;
        for (let t = i; t < j; t += 1) {
            rankSums[pooled[t]!.g] += rank;
        }
        if (j - i > 1) {
            tieTerm += (j - i) ** 3 - (j - i);
        }
        i = j;
    }
    const n = pooled.length;
    let sum = 0;
    for (let g = 0; g < groups.length; g += 1) {
        sum += rankSums[g] ** 2 / groups[g].length;
    }
    const h = (12 / (n * (n + 1))) * sum - 3 * (n + 1);
    const correction = 1 - tieTerm / (n ** 3 - n);
    return { n, rankSums, h, hCorrected: h / correction, correction };
}

describe("Kruskal-Wallis Test", () => {
    it("matches an independent brute-force H with ties on the default input", () => {
        const input = mod.defaultInput as { groups: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(input.groups);
        expect(meta?.["n"]).toBe(expected.n);
        expect(meta?.["rankSums"]).toEqual(expected.rankSums);
        expect(meta?.["h"] as number).toBeCloseTo(expected.h, 10);
        expect(meta?.["tieCorrection"] as number).toBeCloseTo(expected.correction, 10);
        expect(meta?.["hCorrected"] as number).toBeCloseTo(expected.hCorrected, 10);
        const rankSumTotal = (meta?.["rankSums"] as number[]).reduce((sum, value) => sum + value, 0);
        expect(rankSumTotal).toBeCloseTo((expected.n * (expected.n + 1)) / 2, 10);
        const p = meta?.["pValue"] as number;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        expect(p).toBeLessThan(0.05);
    });

    it("handles tied values and gives p near one for identical groups", () => {
        const tied = [...mod.run({ groups: [[1, 1, 2], [2, 2, 1], [1, 2, 2]] })];
        const tiedMeta = tied[tied.length - 1]?.meta;
        expect(tiedMeta?.["tieSizes"]).not.toHaveLength(0);
        expect(tiedMeta?.["hCorrected"] as number).toBeCloseTo(
            reference([[1, 1, 2], [2, 2, 1], [1, 2, 2]]).hCorrected,
            10,
        );

        const identical = [...mod.run({ groups: [[5, 5, 5], [5, 5, 5], [5, 5, 5]] })];
        const p = identical[identical.length - 1]?.meta["pValue"] as number;
        expect(p).toBeGreaterThan(0.99);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
