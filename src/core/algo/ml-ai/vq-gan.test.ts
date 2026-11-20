/**
 * vq-gan.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./vq-gan";
import type { VisualFrame } from "@/types";

type Input = { codebook: number[][]; latent: number[]; beta: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
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

describe("VQ-GAN", () => {
    it("selects the brute-force nearest code and reports the correct loss", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const distances = input.codebook.map((code) =>
            code.reduce((sum, value, i) => sum + (value - (input.latent[i] ?? 0)) ** 2, 0),
        );
        let winner = 0;
        for (let i = 1; i < distances.length; i += 1) {
            if ((distances[i] ?? Infinity) < (distances[winner] ?? Infinity)) {
                winner = i;
            }
        }
        const expectedLoss = (1 + input.beta) * (distances[winner] ?? 0);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["winner"]).toBe(winner);
        expect(final?.["quantized"]).toEqual(input.codebook[winner]);
        expect(Number(final?.["loss"])).toBeCloseTo(expectedLoss, 5);
        const reportedDistances = final?.["distances"] as number[];
        distances.forEach((distance, i) => expect(reportedDistances[i]).toBeCloseTo(distance, 5));
    });

    it("chooses the exact-match code when the latent equals a code", () => {
        const input = { codebook: [[0, 0], [5, 5], [2, 2]], latent: [5, 5], beta: 0.25 };
        const frames = [...mod.run(input)];
        expect(frames[frames.length - 1]?.meta["winner"]).toBe(1);
        expect(Number(frames[frames.length - 1]?.meta["loss"])).toBeCloseTo(0, 6);
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
