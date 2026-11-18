/**
 * momentum-sgd.test.ts - Recurrence cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./momentum-sgd";
import type { VisualFrame } from "@/types";

interface Config {
    target: number;
    start: number;
    lr: number;
    momentum: number;
    steps: number;
}

function reference(cfg: Config): { w: number; velocity: number; losses: number[] } {
    let w = cfg.start;
    let velocity = 0;
    const losses = [(w - cfg.target) ** 2];
    for (let t = 0; t < cfg.steps; t += 1) {
        const gradient = 2 * (w - cfg.target);
        velocity = cfg.momentum * velocity + gradient;
        w -= cfg.lr * velocity;
        losses.push((w - cfg.target) ** 2);
    }
    return { w, velocity, losses };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(index + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["step"]).toBe(index);
    });
}

describe("MomentumSGD", () => {
    it("matches an independent recurrence over many configurations", () => {
        const configs: Config[] = [
            { target: 1, start: 4, lr: 0.05, momentum: 0.9, steps: 24 },
            { target: -2, start: 3, lr: 0.02, momentum: 0.8, steps: 30 },
            { target: 0, start: -5, lr: 0.01, momentum: 0.5, steps: 15 },
        ];
        for (const cfg of configs) {
            const frames = [...mod.run(cfg)];
            checkFrames(frames);
            const expected = reference(cfg);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["w"]).toBeCloseTo(expected.w, 5);
            expect(finalMeta?.["velocity"]).toBeCloseTo(expected.velocity, 5);
            expect(finalMeta?.["loss"]).toBeCloseTo(expected.losses[expected.losses.length - 1] ?? 0, 5);
            expect(Number(finalMeta?.["loss"])).toBeLessThan(expected.losses[0] ?? 0);
        }
    });

    it("converges toward the target for a stable effective step", () => {
        const cfg: Config = { target: 2, start: 10, lr: 0.1, momentum: 0.5, steps: 40 };
        const frames = [...mod.run(cfg)];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["w"])).toBeCloseTo(cfg.target, 2);
        expect(Number(finalMeta?.["loss"])).toBeLessThan(0.01);
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
