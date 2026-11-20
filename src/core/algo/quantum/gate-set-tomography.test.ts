/** gate-set-tomography.test.ts - Independent SPAM/gate inversion, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./gate-set-tomography";
import type { VisualFrame } from "@/types";

function measurement(k: number, theta: number, noise: number, spam: number): number {
    return 0.5 + 0.5 * spam * Math.pow(noise, k) * Math.cos(k * theta);
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Gate set tomography teaching core", () => {
    it("recovers SPAM scale, contraction, and angle from sequences", () => {
        const cases = [
            { theta: 0.6, noise: 0.95, spamScale: 0.8 },
            { theta: 1.1, noise: 0.88, spamScale: 0.65 },
            { theta: -0.4, noise: 0.99, spamScale: 0.9 },
        ];
        for (const input of cases) {
            const frames = [...mod.run({ ...input, sequences: 7 })];
            checkFrames(frames, mod.pseudocode?.length ?? 0);
            const final = frames[frames.length - 1]?.meta;
            const measured = final?.["measured"] as number[];
            for (let k = 0; k < measured.length; k += 1) {
                expect(measured[k]).toBeCloseTo(measurement(k, input.theta, input.noise, input.spamScale), 12);
            }
            expect(Number(final?.["reconstructedSpam"])).toBeCloseTo(input.spamScale, 9);
            expect(Number(final?.["reconstructedNoise"])).toBeCloseTo(input.noise, 9);
            expect(Number(final?.["reconstructedCos"])).toBeCloseTo(Math.cos(input.theta), 9);
            expect(Number(final?.["maxPredictionError"])).toBeLessThan(1e-9);
        }
    });

    it("predicts longer sequences than those used in the fit", () => {
        const frames = [...mod.run({ theta: 0.35, noise: 0.92, spamScale: 0.75, sequences: 9 })];
        const final = frames[frames.length - 1]?.meta;
        const predicted = final?.["predicted"] as number[];
        const spam = Number(final?.["reconstructedSpam"]);
        const noise = Number(final?.["reconstructedNoise"]);
        const cos = Number(final?.["reconstructedCos"]);
        for (let k = 0; k < predicted.length; k += 1) {
            const independent = 0.5 + 0.5 * spam * Math.pow(noise, k) * Math.cos(k * Math.acos(cos));
            expect(predicted[k]).toBeCloseTo(independent, 10);
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
