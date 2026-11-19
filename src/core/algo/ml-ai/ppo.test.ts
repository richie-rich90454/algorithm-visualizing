/** ppo.test.ts - GAE and clipped-surrogate correctness, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./ppo";
import type { VisualFrame } from "@/types";

interface Input {
    oldLogProbs: number[];
    newLogProbs: number[];
    rewards: number[];
    values: number[];
    dones: boolean[];
    gamma: number;
    lam: number;
    clipEps: number;
    valueCoef: number;
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
    const t = input.rewards.length;
    const deltas: number[] = [];
    for (let i = 0; i < t; i += 1) {
        deltas.push(
            input.rewards[i]! +
                input.gamma * (input.dones[i] ? 0 : 1) * (input.values[i + 1] ?? 0) -
                input.values[i]!,
        );
    }
    const advantages = new Array<number>(t).fill(0);
    for (let i = t - 1; i >= 0; i -= 1) {
        advantages[i] =
            deltas[i]! + input.gamma * input.lam * (input.dones[i] ? 0 : 1) * (advantages[i + 1] ?? 0);
    }
    const ratios = input.newLogProbs.map((v, i) => Math.exp(v - input.oldLogProbs[i]!));
    const surrogates = ratios.map((ratio, i) => {
        const adv = advantages[i]!;
        const low = 1 - input.clipEps;
        const high = 1 + input.clipEps;
        const clipped = Math.min(high, Math.max(low, ratio));
        return Math.min(ratio * adv, clipped * adv);
    });
    const policyLoss = -mean(surrogates);
    const valueLoss = input.valueCoef * mean(advantages.map((adv) => adv ** 2));
    return { advantages, ratios, surrogates, policyLoss, valueLoss, totalLoss: policyLoss + valueLoss };
}

describe("Proximal Policy Optimization", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent GAE and clipped surrogate implementation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]!.meta;
        const actualAdv = final["advantages"] as number[];
        const actualRatio = final["ratios"] as number[];
        const actualSur = final["surrogates"] as number[];
        expect(actualAdv.length).toBe(expected.advantages.length);
        expected.advantages.forEach((v, i) => expect(actualAdv[i]!).toBeCloseTo(v, 10));
        expected.ratios.forEach((v, i) => expect(actualRatio[i]!).toBeCloseTo(v, 10));
        expected.surrogates.forEach((v, i) => expect(actualSur[i]!).toBeCloseTo(v, 10));
        expect(Number(final["policyLoss"])).toBeCloseTo(expected.policyLoss, 10);
        expect(Number(final["valueLoss"])).toBeCloseTo(expected.valueLoss, 10);
        expect(Number(final["totalLoss"])).toBeCloseTo(expected.totalLoss, 10);
    });

    it("keeps the clipped ratio inside the trust region", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        const ratios = final["ratios"] as number[];
        const adv = final["advantages"] as number[];
        const sur = final["surrogates"] as number[];
        ratios.forEach((ratio, i) => {
            const clipped = Math.min(1.2, Math.max(0.8, ratio));
            expect(clipped).toBeGreaterThanOrEqual(0.8);
            expect(clipped).toBeLessThanOrEqual(1.2);
            expect(sur[i]!).toBeCloseTo(Math.min(ratio * adv[i]!, clipped * adv[i]!), 10);
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
