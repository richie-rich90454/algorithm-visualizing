/** nerf.test.ts - Brute-force volume rendering, single-sample analytic check, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { volumeRender } from "./nerf";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("NeRF Volume Rendering", () => {
    it("matches a brute-force front-to-back composite", () => {
        const samples = [
            { t: 1, sigma: 0.2, color: [0.9, 0.2, 0.1] },
            { t: 2, sigma: 0.5, color: [0.1, 0.7, 0.3] },
            { t: 3, sigma: 0.1, color: [0.2, 0.3, 0.9] },
        ];
        const got = volumeRender(samples);
        const color = [0, 0, 0];
        let T = 1;
        samples.forEach((sample, i) => {
            const delta = i + 1 < samples.length ? samples[i + 1]!.t - sample.t : sample.t - samples[i - 1]!.t;
            const alpha = 1 - Math.exp(-sample.sigma * delta);
            for (let c = 0; c < 3; c += 1) color[c] = (color[c] ?? 0) + T * alpha * (sample.color[c] ?? 0);
            T *= 1 - alpha;
        });
        got.color.forEach((v, c) => expect(v).toBeCloseTo(color[c] ?? 0, 12));
        expect(got.transmittance).toBeCloseTo(T, 12);
    });

    it("the single-sample result equals the analytic constant-density solution", () => {
        const alpha = 1 - Math.exp(-0.2);
        const got = volumeRender([{ t: 1, sigma: 0.2, color: [0.9, 0.2, 0.1] }]);
        got.color.forEach((v, c) => expect(v).toBeCloseTo(alpha * ([0.9, 0.2, 0.1][c] ?? 0), 12));
        expect(got.transmittance).toBeCloseTo(1 - alpha, 12);
    });

    it("emits well-formed frames whose final color matches the reference", () => {
        const input = mod.defaultInput as { samples: Array<{ t: number; sigma: number; color: number[] }> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = volumeRender(input.samples);
        const final = frames[frames.length - 1]?.meta;
        (final?.["color"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.color[i] ?? 0, 10));
        expect(final?.["transmittance"]).toBeCloseTo(expected.transmittance, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
