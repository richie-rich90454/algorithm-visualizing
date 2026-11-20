/**
 * diffusion-policy.test.ts - Reverse-chain correctness property, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./diffusion-policy";
import type { VisualFrame } from "@/types";

/** Independent reference for the deterministic reverse denoising chain. */
function reference(clean: number[], noise: number[], steps: number) {
    const bars = [1];
    let running = 1;
    for (let t = 1; t <= steps; t += 1) {
        const beta = 0.01 + (0.2 * t) / steps;
        running *= 1 - beta;
        bars.push(running);
    }
    let current = clean.map(
        (value, i) =>
            Math.sqrt(bars[steps] ?? 0) * value +
            Math.sqrt(Math.max(0, 1 - (bars[steps] ?? 0))) * (noise[i] ?? 0),
    );
    let worstNoiseError = 0;
    for (let t = steps; t >= 1; t -= 1) {
        const sqrtBar = Math.sqrt(bars[t] ?? 1);
        const sqrtOneMinusBar = Math.sqrt(Math.max(0, 1 - (bars[t] ?? 1)));
        const eps = current.map(
            (value, i) => (value - sqrtBar * (clean[i] ?? 0)) / Math.max(sqrtOneMinusBar, 1e-12),
        );
        for (let i = 0; i < eps.length; i += 1) {
            worstNoiseError = Math.max(worstNoiseError, Math.abs((eps[i] ?? 0) - (noise[i] ?? 0)));
        }
        const x0 = current.map(
            (value, i) => (value - sqrtOneMinusBar * (eps[i] ?? 0)) / Math.max(sqrtBar, 1e-12),
        );
        const sqrtPrev = Math.sqrt(bars[t - 1] ?? 1);
        const sqrtOneMinusPrev = Math.sqrt(Math.max(0, 1 - (bars[t - 1] ?? 1)));
        current = x0.map((value, i) => sqrtPrev * value + sqrtOneMinusPrev * (eps[i] ?? 0));
    }
    return { recovered: current, worstNoiseError, bars };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Diffusion Policy", () => {
    it("recovers the conditioned clean sequence and respects the receding horizon", () => {
        const input = mod.defaultInput as {
            clean: number[];
            noise: number[];
            steps: number;
            executeSteps: number;
            actionDim: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);

        const expected = reference(input.clean, input.noise, input.steps);
        const finalMeta = frames[frames.length - 1]?.meta;
        const recovered = finalMeta?.["recovered"] as number[];

        for (let i = 0; i < input.clean.length; i += 1) {
            expect(recovered[i]).toBeCloseTo(expected.recovered[i] ?? 0, 6);
            expect(recovered[i]).toBeCloseTo(input.clean[i] ?? 0, 6);
        }
        expect(Number(finalMeta?.["recoveryError"])).toBeLessThan(1e-6);
        expect(Number(finalMeta?.["worstNoiseError"])).toBeLessThan(1e-6);

        const executed = finalMeta?.["executed"] as number[];
        expect(executed.length).toBe(input.executeSteps * input.actionDim);
        for (let i = 0; i < executed.length; i += 1) {
            expect(executed[i]).toBe(recovered[i]);
        }
    });

    it("recovers clean sequences for several noise draws", () => {
        const clean = [2, -1, 0.5, 1.5, -0.75];
        const noises = [
            [0.1, -0.2, 0.3, -0.4, 0.5],
            [-1, 1, -1, 1, -1],
            [0.9, 0.8, 0.7, 0.6, 0.5],
        ];
        for (const noise of noises) {
            const frames = [...mod.run({ clean, noise, steps: 12, executeSteps: 1 })];
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["recoveryError"])).toBeLessThan(1e-6);
            expect(Number(finalMeta?.["worstNoiseError"])).toBeLessThan(1e-6);
        }
    });

    it("uses a strictly decreasing variance schedule inside the unit interval", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const schedule = frames[0]?.meta["schedule"] as number[];
        expect(schedule[0]).toBe(1);
        for (let i = 1; i < schedule.length; i += 1) {
            expect(schedule[i]).toBeLessThan(schedule[i - 1] ?? 0);
            expect(schedule[i]).toBeGreaterThan(0);
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
