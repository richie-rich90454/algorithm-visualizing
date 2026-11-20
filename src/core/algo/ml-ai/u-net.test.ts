/** u-net.test.ts - Shape propagation, parameter totals, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { convParams, unetShapes } from "./u-net";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("U-Net", () => {
    it("convolution parameter count follows the closed form", () => {
        expect(convParams(3, 8)).toBe(3 * 8 * 9 + 8);
    });

    it("propagates shapes and parameters for a two-level net", () => {
        const result = unetShapes(16, 2, 4, 2);
        const records = result.levels;
        expect(records.map((r) => r.stage)).toEqual(["encoder", "bottleneck", "decoder"]);
        expect(records[0]).toMatchObject({ size: 16, inChannels: 4, outChannels: 4 });
        expect(records[1]).toMatchObject({ size: 8, inChannels: 8, outChannels: 8 });
        expect(records[2]).toMatchObject({ size: 16, inChannels: 12, outChannels: 4 });
        const expectedParams = 2 * convParams(4, 4) + 2 * convParams(8, 8) + 2 * convParams(12, 4) + convParams(4, 2);
        expect(result.totalParams).toBe(expectedParams);
        expect(result.outputSize).toBe(16);
    });

    it("a three-level net restores the original size for divisible inputs", () => {
        for (const size of [16, 32, 64]) {
            expect(unetShapes(size, 3, 8, 1).outputSize).toBe(size);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
