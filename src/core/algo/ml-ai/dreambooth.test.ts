/** dreambooth.test.ts - Prior-preservation gradient replay and preservation effect. */
import { describe, expect, it } from "vitest";
import mod from "./dreambooth";
import type { VisualFrame } from "@/types";

interface Input {
    subjectInputs: number[][];
    subjectTargets: number[];
    priorInputs: number[][];
    priorTargets: number[];
    weights: number[];
    lambdaPrior: number;
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
    return a.reduce((sum, v, i) => sum + v * b[i]!, 0);
}

function replay(input: Input) {
    const w = [...input.weights];
    const d = w.length;
    const totals: number[] = [];
    for (let t = 0; t < input.steps; t += 1) {
        const grad = Array(d).fill(0) as number[];
        let subj = 0, prior = 0;
        input.subjectInputs.forEach((x, i) => {
            const r = dot(w, x) - input.subjectTargets[i]!;
            subj += 0.5 * r * r;
            x.forEach((v, j) => { grad[j] += r * v; });
        });
        input.priorInputs.forEach((x, i) => {
            const r = dot(w, x) - input.priorTargets[i]!;
            prior += 0.5 * r * r;
            x.forEach((v, j) => { grad[j] += input.lambdaPrior * r * v; });
        });
        for (let j = 0; j < d; j += 1) w[j] -= input.learningRate * grad[j]!;
        totals.push(subj + input.lambdaPrior * prior);
    }
    return { w, totals };
}

describe("DreamBooth prior preservation", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent gradient replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const ref = replay(input);
        (final["weights"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.w[i]!, 10));
        (final["totalLosses"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.totals[i]!, 10));
    });

    it("ignores the prior samples entirely when the prior weight is zero", () => {
        const plain = replay({ ...input, lambdaPrior: 0 }).w;
        const extremePrior = replay({
            ...input,
            lambdaPrior: 0,
            priorInputs: [[100, -100]],
            priorTargets: [50],
        }).w;
        extremePrior.forEach((v, i) => expect(v).toBeCloseTo(plain[i]!, 10));
        const final = [...mod.run({ ...input, lambdaPrior: 0, priorInputs: [[100, -100]], priorTargets: [50] })].at(-1)!.meta;
        (final["weights"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(plain[i]!, 10));
    });

    it("preserves the class concept better with a larger prior weight", () => {
        const noPrior = [...mod.run({ ...input, lambdaPrior: 0 })].at(-1)!.meta;
        const strongPrior = [...mod.run({ ...input, lambdaPrior: 2 })].at(-1)!.meta;
        const target = input.priorTargets[0]!;
        const predNo = (noPrior["weights"] as number[]).reduce((s, v, i) => s + v * input.priorInputs[0]![i]!, 0);
        const predStrong = (strongPrior["weights"] as number[]).reduce((s, v, i) => s + v * input.priorInputs[0]![i]!, 0);
        expect(Math.abs(predStrong - target)).toBeLessThan(Math.abs(predNo - target));
    });

    it("lowers the combined loss monotonically", () => {
        const final = [...mod.run({ ...input, steps: 60 })].at(-1)!.meta;
        const losses = final["totalLosses"] as number[];
        for (let i = 1; i < losses.length; i += 1) {
            expect(losses[i]!).toBeLessThanOrEqual(losses[i - 1]! + 1e-12);
        }
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
