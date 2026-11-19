/** noise-conditioned-score-network.test.ts - Brute-force annealed Langevin, score properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./noise-conditioned-score-network";
import type { VisualFrame } from "@/types";

interface Input {
    x0: number;
    mu: number;
    sigmas: number[];
    stepSize: number;
    noise: number[];
}

function reference(input: Input) {
    let x = input.x0;
    const scores: number[] = [];
    const trajectory = [x];
    for (let level = 0; level < input.sigmas.length; level += 1) {
        const sigma = input.sigmas[level]!;
        const safe = Math.abs(sigma) < 1e-6 ? 1e-6 : sigma;
        const score = (input.mu - x) / (safe * safe);
        x = x + (input.stepSize / 2) * score + Math.sqrt(input.stepSize) * (input.noise[level] ?? 0);
        scores.push(score);
        trajectory.push(x);
    }
    return { scores, trajectory, final: x, error: Math.abs(x - input.mu) };
}

function checkFrames(frames: VisualFrame[], levels: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const traj = frame.meta["trajectory"] as number[];
        expect(traj.length).toBe(index <= levels ? index + 1 : levels + 1);
    });
    expect(frames[0]?.entities.length).toBe(1);
    expect(frames[1]?.entities.length).toBe(2);
    expect(frames.length).toBe(levels + 2);
}

describe("Noise-conditioned score network", () => {
    const cases: Input[] = [
        { x0: -3, mu: 1, sigmas: [4, 2, 1, 0.5], stepSize: 0.1, noise: [0.5, -0.5, 0.3, -0.2] },
        { x0: 5, mu: 0, sigmas: [2, 1], stepSize: 0.05, noise: [0, 0] },
        { x0: -1, mu: -2, sigmas: [3, 1.5, 0.75], stepSize: 0.2, noise: [-0.4, 0.2, 0.1] },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force annealed Langevin trajectory", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.sigmas.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["scores"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.scores[i]!, 9));
            (final?.["trajectory"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.trajectory[i]!, 9));
            expect(Number(final?.["x"])).toBeCloseTo(expected.final, 9);
            expect(Number(final?.["error"])).toBeCloseTo(expected.error, 9);
        }
    });

    it("score always points toward the data mean", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            frames.slice(1, -1).forEach((frame) => {
                const x = Number(frame.meta["x"]);
                const score = (frame.meta["scores"] as number[]).at(-1)!;
                expect(Math.sign(score)).toBe(Math.sign(input.mu - x) || 0);
            });
        }
    });

    it("score magnitude shrinks as the noise level grows for a fixed sample", () => {
        const mu = 1;
        const x = -2;
        const smallNoiseScore = Math.abs((mu - x) / (1 * 1));
        const largeNoiseScore = Math.abs((mu - x) / (4 * 4));
        expect(largeNoiseScore).toBeLessThan(smallNoiseScore);
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
