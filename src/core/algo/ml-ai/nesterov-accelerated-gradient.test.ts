/** nesterov-accelerated-gradient.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./nesterov-accelerated-gradient";
import type { VisualFrame } from "@/types";

interface Input {
    start: number;
    learningRate: number;
    momentum: number;
    iterations: number;
}

/** Independent replay of the NAG recurrence on f(x)=x^2. */
function reference(input: Input) {
    let theta = input.start;
    let velocity = 0;
    const trace: number[] = [theta];
    for (let i = 0; i < input.iterations; i += 1) {
        const lookahead = theta + input.momentum * velocity;
        const gradient = 2 * lookahead;
        velocity = input.momentum * velocity - input.learningRate * gradient;
        theta += velocity;
        trace.push(theta);
    }
    return { theta, velocity, trace };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Nesterov accelerated gradient", () => {
    it("matches an independent recurrence on several settings", () => {
        const cases: Input[] = [
            { start: 5, learningRate: 0.1, momentum: 0.9, iterations: 12 },
            { start: -3, learningRate: 0.05, momentum: 0.8, iterations: 20 },
            { start: 2, learningRate: 0.02, momentum: 0.95, iterations: 30 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["theta"])).toBeCloseTo(expected.theta, 4);
            expect(Number(finalMeta?.["velocity"])).toBeCloseTo(expected.velocity, 4);
            expect(Number(finalMeta?.["objective"])).toBeCloseTo(expected.theta * expected.theta, 4);
            expect(frames[frames.length - 1]?.entities.length).toBe(expected.trace.length);
        }
    });

    it("descends toward the minimum", () => {
        const input = { start: 5, learningRate: 0.1, momentum: 0.9, iterations: 12 };
        const frames = [...mod.run(input)];
        const first = Number(frames[0]?.meta["objective"]);
        const last = Number(frames[frames.length - 1]?.meta["objective"]);
        expect(last).toBeLessThan(first);
        expect(Math.abs(Number(frames[frames.length - 1]?.meta["theta"]))).toBeLessThan(input.start);
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
