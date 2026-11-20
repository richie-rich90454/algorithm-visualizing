/** alias-method.test.ts - Mass decomposition and sampling-frequency checks. */

import { describe, expect, it } from "vitest";
import mod from "./alias-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    });
}

describe("Alias Method", () => {
    it("satisfies the mass decomposition identity on several distributions", () => {
        const cases = [
            [0.1, 0.2, 0.3, 0.4],
            [0.5, 0.5],
            [0.05, 0.1, 0.15, 0.2, 0.25, 0.25],
            [0.01, 0.02, 0.07, 0.9],
        ];
        for (const probabilities of cases) {
            const frames = [...mod.run({ probabilities, draws: 1000 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const target = final["target"] as number[];
            const prob = final["prob"] as number[];
            const alias = final["alias"] as number[];
            const n = target.length;
            for (let i = 0; i < n; i += 1) {
                expect(prob[i]!).toBeGreaterThanOrEqual(0);
                expect(prob[i]!).toBeLessThanOrEqual(1);
                let mass = prob[i]!;
                for (let j = 0; j < n; j += 1) {
                    if (alias[j] === i && j !== i) mass += 1 - prob[j]!;
                }
                expect(mass / n).toBeCloseTo(target[i]!, 10);
            }
        }
    });

    it("samples frequencies close to the target distribution", () => {
        const probabilities = [0.1, 0.2, 0.3, 0.4];
        const frames = [...mod.run({ probabilities, draws: 40000, seed: 123 })];
        const final = frames[frames.length - 1]!.meta;
        const target = final["target"] as number[];
        const frequencies = final["frequencies"] as number[];
        for (let i = 0; i < target.length; i += 1) {
            expect(Math.abs(frequencies[i]! - target[i]!)).toBeLessThan(0.01);
        }
        expect(frequencies.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
