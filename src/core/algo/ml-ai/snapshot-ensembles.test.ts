/** snapshot-ensembles.test.ts - Reference schedule, averaging properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { cosineCycleLR, ensembleAverage, snapshotPlan } from "./snapshot-ensembles";
import type { VisualFrame } from "@/types";

interface Input {
    totalSteps: number;
    cycles: number;
    predictions: number[][];
    etaMin: number;
    etaMax: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Snapshot ensembles", () => {
    it("cosine schedule hits max at cycle start and min at cycle end", () => {
        const len = 8;
        expect(close(cosineCycleLR(0, len, 0.01, 0.1), 0.1)).toBe(true);
        expect(close(cosineCycleLR(len, len, 0.01, 0.1), 0.01)).toBe(true);
        expect(close(cosineCycleLR(2 * len, len, 0.01, 0.1), 0.01)).toBe(true);
        expect(close(cosineCycleLR(len + 1, len, 0.01, 0.1), cosineCycleLR(1, len, 0.01, 0.1))).toBe(true);
        expect(close(cosineCycleLR(len / 2, len, 0.01, 0.1), 0.055)).toBe(true);
        expect(close(cosineCycleLR(3, 0, 0.01, 0.1), cosineCycleLR(3, 1, 0.01, 0.1))).toBe(true);
    });

    it("snapshot plan marks cycle boundaries", () => {
        expect(snapshotPlan(24, 3)).toEqual([8, 16, 24]);
        expect(snapshotPlan(10, 4)).toEqual([3, 5, 8, 10]);
        expect(snapshotPlan(0, 3)).toEqual([0, 0, 0]);
    });

    it("ensemble average is a componentwise mean", () => {
        const p = [[0.7, 0.2, 0.1], [0.5, 0.4, 0.1], [0.4, 0.5, 0.1]];
        const avg = ensembleAverage(p);
        expect(close(avg[0]!, (0.7 + 0.5 + 0.4) / 3)).toBe(true);
        expect(close(avg[1]!, (0.2 + 0.4 + 0.5) / 3)).toBe(true);
        expect(close(avg[2]!, 0.1)).toBe(true);
        expect(close(avg.reduce((a, b) => a + b, 0), 1)).toBe(true);
        expect(ensembleAverage([])).toEqual([]);
    });

    it("matches the schedule and average through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expectedSnapshots = snapshotPlan(input.totalSteps, input.cycles);
        const expectedAvg = ensembleAverage(input.predictions);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["snapshots"]).toEqual(expectedSnapshots);
        const avg = final?.["averaged"] as number[];
        avg.forEach((v, i) => expect(close(v, expectedAvg[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
