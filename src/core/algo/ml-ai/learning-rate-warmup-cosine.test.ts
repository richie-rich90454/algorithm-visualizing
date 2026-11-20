/**
 * learning-rate-warmup-cosine.test.ts - Formula cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./learning-rate-warmup-cosine";
import type { VisualFrame } from "@/types";

interface Config {
    steps: number;
    warmup: number;
    maxLr: number;
    minLr: number;
}

function rateAt(t: number, cfg: Config): number {
    if (cfg.warmup > 0 && t < cfg.warmup) {
        return (cfg.maxLr * (t + 1)) / cfg.warmup;
    }
    const decaySteps = Math.max(1, cfg.steps - cfg.warmup - 1);
    const progress = Math.min(1, Math.max(0, (t - cfg.warmup) / decaySteps));
    return cfg.minLr + 0.5 * (cfg.maxLr - cfg.minLr) * (1 + Math.cos(Math.PI * progress));
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LearningRateWarmupCosine", () => {
    it("matches the closed-form schedule and its properties", () => {
        const cfg: Config = { steps: 20, warmup: 4, maxLr: 0.001, minLr: 0.00001 };
        const frames = [...mod.run(cfg)];
        checkFrames(frames, cfg.steps);
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["peak"])).toBeCloseTo(cfg.maxLr, 8);
        expect(Number(final?.meta["lr"])).toBeCloseTo(rateAt(cfg.steps - 1, cfg), 8);

        for (let t = 0; t < cfg.steps; t += 1) {
            const frame = frames[t + 1];
            expect(Number(frame?.meta["lr"])).toBeCloseTo(rateAt(t, cfg), 6);
        }
        for (let t = 1; t < cfg.warmup; t += 1) {
            expect(rateAt(t, cfg)).toBeGreaterThan(rateAt(t - 1, cfg));
        }
        for (let t = cfg.warmup + 1; t < cfg.steps; t += 1) {
            expect(rateAt(t, cfg)).toBeLessThanOrEqual(rateAt(t - 1, cfg));
        }
        expect(rateAt(cfg.steps - 1, cfg)).toBeCloseTo(cfg.minLr, 8);
    });

    it("handles zero warmup and many configurations", () => {
        const configs: Config[] = [
            { steps: 10, warmup: 0, maxLr: 0.1, minLr: 0 },
            { steps: 30, warmup: 10, maxLr: 0.01, minLr: 0.001 },
        ];
        for (const cfg of configs) {
            const frames = [...mod.run(cfg)];
            checkFrames(frames, cfg.steps);
            for (let t = 0; t < cfg.steps; t += 1) {
                const rate = rateAt(t, cfg);
                expect(rate).toBeGreaterThanOrEqual(cfg.minLr - 1e-12);
                expect(rate).toBeLessThanOrEqual(cfg.maxLr + 1e-12);
            }
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
