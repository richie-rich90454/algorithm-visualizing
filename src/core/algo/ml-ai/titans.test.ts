/** titans.test.ts - Surprise memory recurrence, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./titans";
import type { VisualFrame } from "@/types";

interface Input {
    tokens: number[][];
    targets: number[];
    memory: number[];
    learningRate: number;
    momentum: number;
    decay: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function replay(input: Input) {
    const memory = [...input.memory];
    const velocity = memory.map(() => 0);
    const surprises: number[] = [];
    const memories: number[][] = [];
    for (let t = 0; t < input.tokens.length; t += 1) {
        const token = input.tokens[t]!;
        const error = dot(memory, token) - input.targets[t]!;
        const gradient = memory.map((_m, i) => error * (token[i] ?? 0));
        const surprise = Math.sqrt(dot(gradient, gradient));
        surprises.push(surprise);
        memory.forEach((m, i) => {
            velocity[i] = input.momentum * velocity[i]! + input.learningRate * gradient[i]!;
            memory[i] = (1 - input.decay) * m - velocity[i]!;
        });
        memories.push([...memory]);
    }
    return { memory, surprises, memories };
}

describe("Titans Surprise-Driven Memory", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent surprise-memory replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = replay(input);
        const final = frames[frames.length - 1]!.meta;
        (final["memory"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.memory[i]!, 10));
        (final["surprises"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.surprises[i]!, 10));
    });

    it("makes surprise equal the prediction-error gradient magnitude", () => {
        const frames = [...mod.run(input)];
        const stepFrames = frames.filter((f) => f.meta["error"] !== undefined);
        expect(stepFrames.length).toBe(input.tokens.length);
        stepFrames.forEach((frame, t) => {
            const error = Number(frame.meta["error"]);
            const token = input.tokens[t]!;
            const expected = Math.abs(error) * Math.sqrt(dot(token, token));
            expect(Number(frame.meta["surprise"])).toBeCloseTo(expected, 10);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
