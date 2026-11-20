/** temperature-sampling.test.ts - Independent softmax oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./temperature-sampling";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[];
    temperature: number;
    seed: number;
}

function reference(input: Input) {
    const scaled = input.logits.map((value) => value / input.temperature);
    const max = Math.max(...scaled);
    const exps = scaled.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    const probability = exps.map((value) => (total === 0 ? 0 : value / total));
    const state = (Math.imul(input.seed >>> 0, 1664525) + 1013904223) >>> 0;
    const draw = state / 4294967296;
    let cumulative = 0;
    let drawn = probability.length - 1;
    for (let i = 0; i < probability.length; i += 1) {
        cumulative += probability[i] ?? 0;
        if (draw < cumulative) {
            drawn = i;
            break;
        }
    }
    return { scaled, probability, draw, drawn };
}

function checkFrames(frames: VisualFrame[], tokens: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(tokens);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Temperature Sampling", () => {
    it("matches an independent scaled-softmax oracle", () => {
        const cases: Input[] = [
            { logits: [2, 1, 0.5, 0.1, -1, -2], temperature: 0.8, seed: 7 },
            { logits: [5, 5, 5, 5], temperature: 2, seed: 3 },
            { logits: [3, -3, 0], temperature: 0.2, seed: 42 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.logits.length);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            (meta?.["scaled"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected.scaled[i] ?? 0, 8));
            (meta?.["probability"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected.probability[i] ?? 0, 8));
            expect(Number(meta?.["draw"])).toBeCloseTo(expected.draw, 12);
            expect(meta?.["drawn"]).toBe(expected.drawn);
        }
    });

    it("keeps a valid distribution and flattens as temperature grows", () => {
        const input: Input = { logits: [3, 1, -1], temperature: 1, seed: 7 };
        const cold = [...mod.run(input)].at(-1)?.meta?.["probability"] as number[];
        const hot = [...mod.run({ ...input, temperature: 1e6 })].at(-1)?.meta?.["probability"] as number[];
        expect(cold.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
        expect(hot.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
        expect(Math.max(...hot) - Math.min(...hot)).toBeLessThan(Math.max(...cold) - Math.min(...cold));
        expect(hot[0]).toBeCloseTo(1 / 3, 3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
