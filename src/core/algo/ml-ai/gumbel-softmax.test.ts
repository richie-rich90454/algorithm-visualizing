/** gumbel-softmax.test.ts - Reference match, probability properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./gumbel-softmax";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[];
    uniforms: number[];
    temperature: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function gumbel(u: number): number {
    const c = Math.min(1 - 1e-12, Math.max(1e-12, u));
    return -Math.log(-Math.log(c));
}

function reference(input: Input) {
    const perturbed = input.logits.map((l, i) => l + gumbel(input.uniforms[i] ?? 0.5));
    const scaled = perturbed.map((v) => v / input.temperature);
    const max = Math.max(...scaled);
    const exps = scaled.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, v) => a + v, 0);
    const probs = exps.map((v) => v / sum);
    let chosen = 0;
    for (let i = 1; i < probs.length; i += 1) if (probs[i]! > probs[chosen]!) chosen = i;
    return { probs, chosen };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gumbel-Softmax", () => {
    it("matches an independent Gumbel-max softmax computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const probs = final?.["probs"] as number[];
        probs.forEach((p, i) => expect(close(p, expected.probs[i]!)).toBe(true));
        expect(final?.["chosen"]).toBe(expected.chosen);
        expect(close(probs.reduce((a, v) => a + v, 0), 1)).toBe(true);
    });

    it("lowering the temperature sharpens the relaxed sample", () => {
        const input = mod.defaultInput as Input;
        const hot = [...mod.run({ ...input, temperature: 2 })].at(-1)?.meta["probs"] as number[];
        const cold = [...mod.run({ ...input, temperature: 0.1 })].at(-1)?.meta["probs"] as number[];
        expect(Math.max(...cold)).toBeGreaterThan(Math.max(...hot));
        expect(Math.max(...cold)).toBeGreaterThan(0.9);
    });

    it("chosen category is the largest probability", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const probs = final?.["probs"] as number[];
        const chosen = final?.["chosen"] as number;
        expect(probs[chosen]).toBe(Math.max(...probs));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
