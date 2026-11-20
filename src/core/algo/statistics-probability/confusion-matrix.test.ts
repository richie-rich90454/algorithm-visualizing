/**
 * confusion-matrix.test.ts - Brute-force cell counts, rate identities, frame
 * shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./confusion-matrix";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(2);
    });
}

describe("ConfusionMatrix", () => {
    it("matches brute-force cell counts and derived rates", () => {
        const input = mod.defaultInput as { actual: number[]; predicted: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.actual.length);
        let tp = 0;
        let fp = 0;
        let fn = 0;
        let tn = 0;
        for (let i = 0; i < input.actual.length; i += 1) {
            const truth = (input.actual[i] ?? 0) >= 0.5 ? 1 : 0;
            const decision = (input.predicted[i] ?? 0) >= 0.5 ? 1 : 0;
            if (decision === 1 && truth === 1) tp += 1;
            else if (decision === 1 && truth === 0) fp += 1;
            else if (decision === 0 && truth === 1) fn += 1;
            else tn += 1;
        }
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["tn"]).toBe(tn);
        expect(meta["fp"]).toBe(fp);
        expect(meta["fn"]).toBe(fn);
        expect(meta["tp"]).toBe(tp);
        expect((meta["tn"] as number) + (meta["fp"] as number) + (meta["fn"] as number) + (meta["tp"] as number)).toBe(input.actual.length);
        expect(Number(meta["precision"])).toBeCloseTo(tp + fp === 0 ? 0 : tp / (tp + fp), 12);
        expect(Number(meta["recall"])).toBeCloseTo(tp + fn === 0 ? 0 : tp / (tp + fn), 12);
        expect(Number(meta["accuracy"])).toBeCloseTo((tp + tn) / input.actual.length, 12);

        const labels = frames[frames.length - 1]!.entities.map((e) => e.label);
        expect(labels).toContain(`TN ${tn}`);
        expect(labels).toContain(`FP ${fp}`);
        expect(labels).toContain(`FN ${fn}`);
        expect(labels).toContain(`TP ${tp}`);
    });

    it("counts cells exactly once per item across random cases", () => {
        let state = 987654321;
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 3 + (trial % 9);
            const actual: number[] = [];
            const predicted: number[] = [];
            for (let i = 0; i < n; i += 1) {
                state = (Math.imul(1664525, state) + 1013904223) >>> 0;
                actual.push(state % 2);
                state = (Math.imul(1664525, state) + 1013904223) >>> 0;
                predicted.push(state % 2);
            }
            const frames = [...mod.run({ actual, predicted })];
            checkFrames(frames, n);
            const meta = frames[frames.length - 1]!.meta;
            const sum = (meta["tn"] as number) + (meta["fp"] as number) + (meta["fn"] as number) + (meta["tp"] as number);
            expect(sum).toBe(n);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
