/** fast-gradient-sign-method.test.ts - Independent FGSM attack, budget bound, loss increase, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./fast-gradient-sign-method";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[];
    weights: number[];
    bias: number;
    label: number;
    epsilon: number;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["d"]).toBe(d);
    });
}

function reference(input: Input) {
    const score = (x: number[]) => x.reduce((s, v, i) => s + v * input.weights[i]!, input.bias);
    const before = score(input.x);
    const error = before - input.label;
    const grad = input.weights.map((w) => error * w);
    const perturb = grad.map((g) => (g > 0 ? input.epsilon : (g < 0 ? -input.epsilon : 0)));
    const adv = input.x.map((v, i) => v + perturb[i]!);
    const after = score(adv);
    return {
        grad,
        perturb,
        adv,
        before,
        after,
        lossBefore: 0.5 * error * error,
        lossAfter: 0.5 * Math.pow(after - input.label, 2),
    };
}

describe("Fast Gradient Sign Method", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent FGSM computation", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(4);
        checkFrames(frames, input.x.length);
        const expected = reference(input);
        const meta = frames.at(-1)!.meta;
        (meta["gradient"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.grad[i]!, 10));
        (meta["perturbation"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.perturb[i]!, 10));
        (meta["adversarial"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.adv[i]!, 10));
        expect(Number(meta["scoreBefore"])).toBeCloseTo(expected.before, 10);
        expect(Number(meta["scoreAfter"])).toBeCloseTo(expected.after, 10);
        expect(Number(meta["lossBefore"])).toBeCloseTo(expected.lossBefore, 10);
        expect(Number(meta["lossAfter"])).toBeCloseTo(expected.lossAfter, 10);
    });

    it("respects the epsilon budget coordinate by coordinate", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const grad = meta["gradient"] as number[];
        const perturb = meta["perturbation"] as number[];
        perturb.forEach((p, i) => {
            expect(Math.abs(p)).toBeLessThanOrEqual(input.epsilon + 1e-12);
            if (grad[i] !== 0) {
                expect(p).toBeCloseTo(Math.sign(grad[i]!) * input.epsilon, 12);
            }
        });
    });

    it("increases loss and pushes the score away from the label", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        expect(Number(meta["lossAfter"])).toBeGreaterThan(Number(meta["lossBefore"]));
        expect(Math.abs(Number(meta["scoreAfter"]) - input.label)).toBeGreaterThan(
            Math.abs(Number(meta["scoreBefore"]) - input.label),
        );
    });

    it("does not move when the model is already correct", () => {
        const zeroed = { ...input, weights: [0, 0, 0], bias: input.label };
        const meta = [...mod.run(zeroed)].at(-1)!.meta;
        (meta["perturbation"] as number[]).forEach((v) => expect(v).toBe(0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
