/** grpo.test.ts - Group normalization, clipped surrogate, and KL correctness. */
import { describe, expect, it } from "vitest";
import mod from "./grpo";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[][];
    oldLogProbs: number[][];
    newLogProbs: number[][];
    refLogProbs: number[][];
    clipEps: number;
    beta: number;
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

function mean(values: number[]): number {
    return values.reduce((a, v) => a + v, 0) / values.length;
}

function reference(input: Input) {
    const advantages: number[] = [];
    const ratios: number[] = [];
    const surrogates: number[] = [];
    const kls: number[] = [];
    for (let g = 0; g < input.rewards.length; g += 1) {
        const r = input.rewards[g]!;
        const mu = mean(r);
        const sigma = Math.sqrt(mean(r.map((v) => (v - mu) ** 2)));
        const adv = r.map((v) => (v - mu) / (sigma + 1e-8));
        advantages.push(...adv);
        r.forEach((_v, i) => {
            const ratio = Math.exp(input.newLogProbs[g]![i]! - input.oldLogProbs[g]![i]!);
            const clipped = Math.min(1 + input.clipEps, Math.max(1 - input.clipEps, ratio));
            ratios.push(ratio);
            surrogates.push(Math.min(ratio * adv[i]!, clipped * adv[i]!));
            const delta = input.refLogProbs[g]![i]! - input.newLogProbs[g]![i]!;
            kls.push(Math.exp(delta) - delta - 1);
        });
    }
    const policyLoss = -mean(surrogates);
    const meanKl = mean(kls);
    return { advantages, ratios, surrogates, kls, policyLoss, meanKl, loss: policyLoss + input.beta * meanKl };
}

describe("Group Relative Policy Optimization", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent group-standardized objective implementation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]!.meta;
        (final["advantages"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.advantages[i]!, 8));
        (final["ratios"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.ratios[i]!, 8));
        (final["surrogates"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.surrogates[i]!, 8));
        expect(Number(final["policyLoss"])).toBeCloseTo(expected.policyLoss, 8);
        expect(Number(final["meanKl"])).toBeCloseTo(expected.meanKl, 8);
        expect(Number(final["loss"])).toBeCloseTo(expected.loss, 8);
    });

    it("standardizes each group to mean zero and unit spread", () => {
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const group = frame.meta["advantages"] as number[] | undefined;
            if (!group || group.length < 2 || frame.meta["group"] === undefined) {
                continue;
            }
            const mu = mean(group);
            const variance = mean(group.map((v) => (v - mu) ** 2));
            expect(mu).toBeCloseTo(0, 8);
            expect(Math.sqrt(variance)).toBeCloseTo(1, 6);
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
