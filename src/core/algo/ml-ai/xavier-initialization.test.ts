/** xavier-initialization.test.ts - Independent bound and variance checks, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { xavierUniformBound } from "./xavier-initialization";
import type { VisualFrame } from "@/types";

interface Input {
    fanIn: number;
    fanOut: number;
    samples: number;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["count"]).toBe(count);
    });
}

describe("Xavier Initialization", () => {
    const input = mod.defaultInput as Input;

    it("draws within bound with variance close to two over fan-in plus fan-out", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.samples + 2);
        checkFrames(frames, input.samples);
        const meta = frames.at(-1)!.meta;
        const bound = Math.sqrt(6 / (input.fanIn + input.fanOut));
        expect(xavierUniformBound(input.fanIn, input.fanOut)).toBeCloseTo(bound, 12);
        const weights = meta["weights"] as number[];
        weights.forEach((w) => expect(Math.abs(w)).toBeLessThanOrEqual(bound + 1e-12));
        const variance = weights.reduce((s, v) => s + v * v, 0) / weights.length;
        expect(variance).toBeCloseTo(2 / (input.fanIn + input.fanOut), 2);
        expect(Number(meta["empiricalVariance"])).toBeCloseTo(variance, 12);
    });

    it("matches an independent stratified formula for every weight", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const weights = meta["weights"] as number[];
        const bound = Math.sqrt(6 / (input.fanIn + input.fanOut));
        weights.forEach((w, i) => {
            expect(w).toBeCloseTo(bound * ((2 * (i + 0.5)) / input.samples - 1), 12);
        });
    });

    it("differs from He initialization when fan-out is not equal to fan-in", () => {
        const xavierVar = Number([...mod.run({ fanIn: 4, fanOut: 12, samples: 500 })].at(-1)!.meta["theoreticalVariance"]);
        const heVar = 2 / 4;
        expect(xavierVar).toBeCloseTo(2 / 16, 12);
        expect(xavierVar).not.toBeCloseTo(heVar, 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.samples + 2);
        expect(generator.next().done).toBe(true);
    });
});
