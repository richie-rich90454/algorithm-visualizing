import { describe, expect, it } from "vitest";
import mod from "./ring-allgather";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(p * p);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ring All-Gather", () => {
    it("gathers the exact ordered data on every process", () => {
        const input = mod.defaultInput as { chunks: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.chunks.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["complete"]).toBe(true);
        expect(final?.["gathered"]).toEqual(input.chunks.flat());
        expect(Number(final?.["transfers"])).toBe(input.chunks.length * (input.chunks.length - 1));
        const lastFrame = frames[frames.length - 1] as VisualFrame;
        expect(lastFrame.entities.every((e) => e.state === "sorted")).toBe(true);
        expect(frames.length).toBe(input.chunks.length + 1);
    });

    it("handles one, two, and five processes", () => {
        for (const chunks of [
            [[9]],
            [
                [1],
                [2],
            ],
            [[1], [2], [3], [4], [5]],
        ]) {
            const frames = [...mod.run({ chunks })];
            checkFrames(frames, chunks.length);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["complete"]).toBe(true);
            expect(final?.["gathered"]).toEqual(chunks.flat());
            expect(frames.length).toBe(chunks.length + 1);
        }
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
