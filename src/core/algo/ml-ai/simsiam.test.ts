/** simsiam.test.ts - Stop-gradient cosine loss and finite-difference gradient check. */
import { describe, expect, it } from "vitest";
import mod from "./simsiam";
import type { VisualFrame } from "@/types";

interface Input {
    view1: number[];
    view2: number[];
    predictor: number[];
    steps: number;
    learningRate: number;
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

function cosine(a: number[], b: number[]): number {
    const na = Math.sqrt(dot(a, a));
    const nb = Math.sqrt(dot(b, b));
    return na === 0 || nb === 0 ? 0 : dot(a, b) / (na * nb);
}

/** Symmetric negative-cosine objective with detached targets. */
function objective(p: number[], input: Input): number {
    const pred1 = p.map((v, i) => v * input.view1[i]!);
    const pred2 = p.map((v, i) => v * input.view2[i]!);
    return -0.5 * (cosine(pred1, input.view2) + cosine(pred2, input.view1));
}

function numericGradient(p: number[], input: Input): number[] {
    const h = 1e-6;
    return p.map((_v, i) => {
        const plus = [...p];
        const minus = [...p];
        plus[i] = plus[i]! + h;
        minus[i] = minus[i]! - h;
        return (objective(plus, input) - objective(minus, input)) / (2 * h);
    });
}

describe("Simple Siamese Learning", () => {
    const input = mod.defaultInput as Input;

    it("matches a finite-difference gradient replay of the objective", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const p = [...input.predictor];
        for (let t = 0; t < input.steps; t += 1) {
            const grad = numericGradient(p, input);
            p.forEach((v, i) => {
                p[i] = v - input.learningRate * grad[i]!;
            });
        }
        const final = frames[frames.length - 1]!.meta;
        (final["predictor"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(p[i]!, 6));
    });

    it("reports the analytic loss and improves it over training", () => {
        const frames = [...mod.run(input)];
        const stepFrames = frames.filter((f) => f.meta["iteration"] !== undefined);
        expect(stepFrames.length).toBe(input.steps);
        const first = Number(stepFrames[0]!.meta["loss"]);
        const last = Number(stepFrames[stepFrames.length - 1]!.meta["loss"]);
        expect(last).toBeLessThan(first);
        stepFrames.forEach((frame) => {
            const expected = objective(frame.meta["predictor"] as number[], input);
            expect(Number(frame.meta["loss"])).toBeCloseTo(expected, 10);
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
