/** thompson-sampling.test.ts - Posterior invariant, reproducibility, convergence, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./thompson-sampling";
import type { VisualFrame } from "@/types";

type Meta = Record<string, number | string | boolean | Array<number | string>>;

const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number) : []);

function checkFrames(frames: VisualFrame[], arms: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(arms);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Thompson Sampling", () => {
    it("keeps exact Beta-Bernoulli posterior invariants every round", () => {
        const frames = [...mod.run({ rates: [0.2, 0.8, 0.5], rounds: 60, seed: 9 })];
        checkFrames(frames, 3);
        for (const frame of frames) {
            const meta = frame.meta as Meta;
            const alpha = arr(meta["alpha"]);
            const beta = arr(meta["beta"]);
            const pulls = arr(meta["pulls"]);
            const rewards = arr(meta["rewards"]);
            const totalPulls = pulls.reduce((a, b) => a + b, 0);
            const totalRewards = rewards.reduce((a, b) => a + b, 0);
            expect(totalPulls).toBe(Number(meta["round"]));
            for (let i = 0; i < 3; i += 1) {
                expect(alpha[i] as number).toBe(1 + (rewards[i] as number));
                expect(beta[i] as number).toBe(1 + (pulls[i] as number) - (rewards[i] as number));
                expect((alpha[i] as number) + (beta[i] as number)).toBe(2 + (pulls[i] as number));
            }
            expect(totalRewards).toBeLessThanOrEqual(totalPulls);
        }
    });

    it("reproduces its decisions exactly for a fixed seed", () => {
        const input = { rates: [0.3, 0.7], rounds: 80, seed: 2026 };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a.map((f) => f.meta["chosen"])).toEqual(b.map((f) => f.meta["chosen"]));
        expect(a.at(-1)?.meta["pulls"]).toEqual(b.at(-1)?.meta["pulls"]);
    });

    it("concentrates pulls on the best arm on an easy instance", () => {
        const meta = [...mod.run({ rates: [0.05, 0.9, 0.2], rounds: 400, seed: 31 })].at(-1)?.meta as Meta;
        const pulls = arr(meta["pulls"]);
        expect(Number(meta["best"])).toBe(1);
        expect(pulls[1] as number).toBeGreaterThan(pulls[0] as number);
        expect(pulls[1] as number).toBeGreaterThan(pulls[2] as number);
        expect((pulls[0] as number) + (pulls[1] as number) + (pulls[2] as number)).toBe(400);
    });

    it("keeps sampled rates inside the unit interval", () => {
        const frames = [...mod.run({ rates: [0.1, 0.9], rounds: 50, seed: 5 })].slice(1, -1);
        for (const frame of frames) {
            for (const s of arr(frame.meta["sampled"])) {
                expect(s).toBeGreaterThanOrEqual(0);
                expect(s).toBeLessThanOrEqual(1);
            }
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
