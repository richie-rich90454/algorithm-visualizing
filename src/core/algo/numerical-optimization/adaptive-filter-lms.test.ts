/**
 * adaptive-filter-lms.test.ts - Reference agreement and convergence checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adaptive-filter-lms";
import type { VisualFrame } from "@/types";

function makeSignal(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state / 4294967296) * 2 - 1;
    };
}

/** Independent replay of the LMS adaptation. */
function reference(order: number, mu: number, samples: number, seed: number) {
    const target = Array.from({ length: order }, (_, i) => (1 / (i + 1)) * (i % 2 === 0 ? 1 : -1));
    const random = makeSignal(seed);
    const signal = Array.from({ length: samples }, () => random());
    const desired = Array.from({ length: samples }, () => 0);
    for (let n = 0; n < samples; n += 1) {
        let value = 0;
        for (let k = 0; k < order; k += 1) {
            if (n - k >= 0) value += target[k]! * signal[n - k]!;
        }
        desired[n] = value;
    }
    const weights = Array.from({ length: order }, () => 0);
    const errors: number[] = [];
    for (let n = order - 1; n < samples; n += 1) {
        let output = 0;
        for (let k = 0; k < order; k += 1) output += weights[k]! * signal[n - k]!;
        const error = desired[n]! - output;
        for (let k = 0; k < order; k += 1) weights[k] += mu * error * signal[n - k]!;
        errors.push(error * error);
    }
    return { weights, target, errors };
}

function checkFrames(frames: VisualFrame[], order: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(order);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LMS adaptive filter", () => {
    it("reproduces an independent reference trajectory", () => {
        const settings = { order: 3, mu: 0.05, samples: 60, seed: 7 };
        const frames = [...mod.run(settings)];
        checkFrames(frames, settings.order);
        const final = frames[frames.length - 1]!.meta;
        const expected = reference(settings.order, settings.mu, settings.samples, settings.seed);
        const weights = final["weights"] as number[];
        for (let k = 0; k < settings.order; k += 1) {
            expect(weights[k]).toBeCloseTo(expected.weights[k]!, 6);
        }
        const target = final["target"] as number[];
        for (let k = 0; k < settings.order; k += 1) {
            expect(target[k]).toBeCloseTo(expected.target[k]!, 10);
        }
    });

    it("reduces error and moves weights toward the unknown system", () => {
        const settings = { order: 3, mu: 0.05, samples: 60, seed: 7 };
        const expected = reference(settings.order, settings.mu, settings.samples, settings.seed);
        const first = expected.errors.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const last = expected.errors.slice(-10).reduce((a, b) => a + b, 0) / 10;
        expect(last).toBeLessThan(first / 5);
        const initialDistance = Math.hypot(...expected.target);
        const finalDistance = Math.hypot(
            ...expected.weights.map((w, i) => w - expected.target[i]!),
        );
        expect(finalDistance).toBeLessThan(initialDistance * 0.6);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ order: 2, mu: 0.1, samples: 30, seed: 99 })];
        const b = [...mod.run({ order: 2, mu: 0.1, samples: 30, seed: 99 })];
        expect(a.length).toBe(b.length);
        expect(a[a.length - 1]!.meta["weights"]).toEqual(b[b.length - 1]!.meta["weights"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
