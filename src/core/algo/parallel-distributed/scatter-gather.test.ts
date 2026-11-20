/**
 * scatter-gather.test.ts - Reconstruction and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./scatter-gather";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], processes: number): void {
    expect(frames.length).toBe(2 * processes + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(processes + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(processes);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Scatter-gather", () => {
    it("reassembles the original data exactly", () => {
        const cases: Array<{ data: number[]; processes: number }> = [
            { data: [1, 2, 3, 4, 5, 6, 7, 8], processes: 4 },
            { data: [10, 20, 30], processes: 3 },
            { data: [5, 4, 3, 2, 1], processes: 2 },
            { data: [7, 8, 9], processes: 2 },
        ];
        for (const { data, processes } of cases) {
            const frames = [...mod.run({ data, processes })];
            checkFrames(frames, processes);
            const final = frames[frames.length - 1]!.meta;
            expect(final["assembled"]).toEqual(data);
            expect(final["chunks"]).toEqual(data);
            expect(final["gatherDone"]).toBe(true);
            expect(final["scatterDone"]).toBe(true);
            const sizes = final["workerSizes"] as number[];
            expect(sizes.reduce((a, b) => a + b, 0)).toBe(data.length);
            expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        }
    });

    it("fills chunks progressively during scatter and gather", () => {
        const processes = 4;
        const frames = [...mod.run({ data: [1, 2, 3, 4, 5, 6, 7, 8], processes })];
        const scatterFrames = frames.slice(1, 1 + processes);
        for (let i = 0; i < scatterFrames.length; i += 1) {
            const sizes = scatterFrames[i]!.meta["workerSizes"] as number[];
            expect(sizes.filter((size) => size > 0).length).toBe(i + 1);
        }
        const gatherFrames = frames.slice(2 + processes, 2 + 2 * processes);
        for (let i = 0; i < gatherFrames.length; i += 1) {
            const assembled = gatherFrames[i]!.meta["assembled"] as number[];
            expect(assembled.length).toBe((i + 1) * 2);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
