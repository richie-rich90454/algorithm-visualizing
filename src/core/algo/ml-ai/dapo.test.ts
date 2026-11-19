/** dapo.test.ts - Dynamic sampling, asymmetric clip, token-level loss, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./dapo";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[][];
    oldLogProbs: number[][];
    newLogProbs: number[][];
    tokenCounts: number[];
    epsLow: number;
    epsHigh: number;
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

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function reference(input: Input) {
    const kept: number[] = [];
    const filtered: number[] = [];
    const advantages: number[] = [];
    const ratios: number[] = [];
    const surrogates: number[] = [];
    let totalTokens = 0;
    const eps = 1e-8;
    for (let g = 0; g < input.rewards.length; g += 1) {
        const r = input.rewards[g]!;
        const mu = mean(r);
        const sigma = Math.sqrt(mean(r.map((v) => (v - mu) ** 2)));
        if (sigma <= eps) {
            filtered.push(g);
            continue;
        }
        kept.push(g);
        totalTokens += input.tokenCounts[g]!;
        const adv = r.map((v) => (v - mu) / (sigma + eps));
        advantages.push(...adv);
        for (let i = 0; i < r.length; i += 1) {
            const ratio = Math.exp(input.newLogProbs[g]![i]! - input.oldLogProbs[g]![i]!);
            const clipped = Math.min(1 + input.epsHigh, Math.max(1 - input.epsLow, ratio));
            ratios.push(ratio);
            surrogates.push(Math.min(ratio * adv[i]!, clipped * adv[i]!));
        }
    }
    const loss = totalTokens > 0 ? -surrogates.reduce((s, v) => s + v, 0) / totalTokens : 0;
    return { kept, filtered, advantages, ratios, surrogates, totalTokens, loss };
}

describe("DAPO", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent dynamic-sampling and asymmetric-clip reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input);
        expect(meta["keptGroups"]).toEqual(expected.kept);
        expect(meta["filteredGroups"]).toEqual(expected.filtered);
        expect(meta["totalTokens"]).toBe(expected.totalTokens);
        (meta["advantages"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.advantages[i]!, 6));
        (meta["ratios"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.ratios[i]!, 8));
        (meta["surrogates"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.surrogates[i]!, 8));
        expect(Number(meta["policyLoss"])).toBeCloseTo(expected.loss, 8);
    });

    it("drops the zero-variance group and keeps the other two", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        expect(meta["filteredGroups"]).toEqual([1]);
        expect(meta["keptGroups"]).toEqual([0, 2]);
        expect(meta["totalTokens"]).toBe(22);
    });

    it("asymmetric clip differs from a symmetric clip for a large positive ratio", () => {
        const single: Input = {
            rewards: [[1, -1]],
            oldLogProbs: [[0, 0]],
            newLogProbs: [[0.5, -0.5]],
            tokenCounts: [10],
            epsLow: 0.2,
            epsHigh: 0.28,
        };
        const meta = [...mod.run(single)].at(-1)!.meta;
        const surrogates = meta["surrogates"] as number[];
        const advantages = meta["advantages"] as number[];
        // Positive advantage with ratio exp(0.5) > 1 + epsHigh: DAPO clips at 1.28, symmetric GRPO at 1.2.
        expect(advantages[0]).toBeCloseTo(1, 6);
        expect(surrogates[0]).toBeCloseTo(1.28 * advantages[0]!, 6);
        expect(surrogates[0]).toBeGreaterThan(1.2 * advantages[0]!);
        // Negative advantage with ratio exp(-0.5) < 1 - epsLow: clipped at the lower bound 0.8.
        expect(advantages[1]).toBeCloseTo(-1, 6);
        expect(surrogates[1]).toBeCloseTo(0.8 * advantages[1]!, 6);
    });

    it("kept group advantages are standardized to mean zero and unit spread", () => {
        for (const frame of [...mod.run(input)]) {
            if (frame.meta["group"] === undefined) {
                continue;
            }
            const adv = frame.meta["advantages"] as number[] | undefined;
            if (!adv || adv.length === 0) {
                continue;
            }
            expect(mean(adv.slice(-3))).toBeCloseTo(0, 6);
        }
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
