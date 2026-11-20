/** squeezenet.test.ts - Independent parameter-count oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./squeezenet";
import type { VisualFrame } from "@/types";

interface Input {
    inChannels: number;
    squeeze: number;
    expand1: number;
    expand3: number;
}

function reference(input: Input) {
    const squeezeParams = input.squeeze * input.inChannels;
    const expand1Params = input.expand1 * input.squeeze;
    const expand3Params = input.expand3 * input.squeeze * 9;
    const total = squeezeParams + expand1Params + expand3Params;
    const dense = input.inChannels * (input.expand1 + input.expand3) * 9;
    return { outChannels: input.expand1 + input.expand3, squeezeParams, expand1Params, expand3Params, total, dense, reduction: dense / total };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SqueezeNet Fire Module", () => {
    it("matches an independent parameter-count oracle", () => {
        const cases: Input[] = [
            { inChannels: 64, squeeze: 16, expand1: 32, expand3: 32 },
            { inChannels: 32, squeeze: 8, expand1: 16, expand3: 24 },
            { inChannels: 128, squeeze: 16, expand1: 64, expand3: 48 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["outChannels"]).toBe(expected.outChannels);
            const params = meta?.["params"] as number[];
            expect(params[0]).toBe(expected.squeezeParams);
            expect(params[1]).toBe(expected.expand1Params);
            expect(params[2]).toBe(expected.expand3Params);
            expect(params[3]).toBe(expected.total);
            expect(params[4]).toBe(expected.dense);
            expect(Number(meta?.["reduction"])).toBeCloseTo(expected.reduction, 8);
        }
    });

    it("always saves parameters over a dense layer", () => {
        const input: Input = { inChannels: 96, squeeze: 12, expand1: 48, expand3: 48 };
        const meta = [...mod.run(input)].at(-1)?.meta;
        expect(Number(meta?.["reduction"])).toBeGreaterThan(1);
        const params = meta?.["params"] as number[];
        expect(params[3]).toBeLessThan(params[4] ?? 0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
