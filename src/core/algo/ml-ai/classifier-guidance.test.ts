/** classifier-guidance.test.ts - Independent guided-mean reference, zero-scale identity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./classifier-guidance";
import type { VisualFrame } from "@/types";

interface Input {
    baseMeans: number[][];
    xs: number[][];
    w: number[];
    c: number;
    scale: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function reference(input: Input) {
    const grads = input.xs.map((row) => row.map((x, j) => input.w[j]! + 2 * input.c * x));
    const guided = grads.map((grad, t) => grad.map((g, j) => input.baseMeans[t]![j]! + input.scale * g));
    return { grads, guided };
}

describe("Classifier Guidance", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent classifier-gradient and guided-mean reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input);
        (meta["grads"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.grads.flat()[i]!, 8));
        (meta["guided"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.guided.flat()[i]!, 8));
    });

    it("guided mean equals base mean when the scale is zero", () => {
        const zero = { ...input, scale: 0 };
        const meta = [...mod.run(zero)].at(-1)!.meta;
        expect(meta["guided"]).toEqual(meta["baseMeans"]);
    });

    it("guided mean equals base mean when the classifier is constant zero", () => {
        const zero = { ...input, w: input.w.map(() => 0), c: 0 };
        const meta = [...mod.run(zero)].at(-1)!.meta;
        expect(meta["guided"]).toEqual(meta["baseMeans"]);
        expect(meta["grads"]).toEqual(input.xs.flat().map(() => 0));
    });

    it("the shift equals scale times gradient componentwise", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const base = meta["baseMeans"] as number[];
        const grad = meta["grads"] as number[];
        const guided = meta["guided"] as number[];
        guided.forEach((v, i) => expect(v).toBeCloseTo(base[i]! + input.scale * grad[i]!, 8));
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
