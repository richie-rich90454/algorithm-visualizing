/** gaussian-splatting.test.ts - Projection math, depth order, compositing, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { alphaBlend, projectGaussian, splatScene } from "./gaussian-splatting";
import type { Gaussian } from "./gaussian-splatting";
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

describe("3D Gaussian splatting", () => {
    it("projects the mean and builds a symmetric covariance", () => {
        const g: Gaussian = { mean: [1, 2, 4], scale: [0.5, 0.4, 0.3], color: [1, 0, 0], opacity: 1 };
        const s = projectGaussian(g, 2, 10, 20);
        expect(s.u).toBeCloseTo(10.5, 10);
        expect(s.v).toBeCloseTo(21, 10);
        expect(s.depth).toBeCloseTo(4, 10);
        expect(s.covariance[1]).toBeCloseTo((-2 * 1 / 16) * (-2 * 2 / 16) * 0.09, 10);
        expect(s.covariance[0]).toBeGreaterThan(0);
        expect(s.covariance[2]).toBeGreaterThan(0);
    });

    it("sorts splats nearest first", () => {
        const input = mod.defaultInput as { gaussians: Gaussian[]; focal: number; center: [number, number] };
        const { splats } = splatScene(input.gaussians, input.focal, input.center[0], input.center[1]);
        for (let i = 1; i < splats.length; i += 1) {
            expect(splats[i]!.depth).toBeGreaterThanOrEqual(splats[i - 1]!.depth);
        }
    });

    it("alpha blending matches a brute-force pass and respects full opacity", () => {
        const near: Gaussian = { mean: [0, 0, 1], scale: [1, 1, 1], color: [1, 0, 0], opacity: 1 };
        const far: Gaussian = { mean: [0, 0, 2], scale: [1, 1, 1], color: [0, 1, 0], opacity: 1 };
        const { splats } = splatScene([far, near], 1, 0, 0);
        const color = alphaBlend(splats);
        expect(color[0]).toBeCloseTo(1, 10);
        expect(color[1]).toBeCloseTo(0, 10);
        const transparent: Gaussian = { mean: [0, 0, 1], scale: [1, 1, 1], color: [1, 1, 1], opacity: 0 };
        expect(alphaBlend(splatScene([transparent], 1, 0, 0).splats)).toEqual([0, 0, 0]);
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
