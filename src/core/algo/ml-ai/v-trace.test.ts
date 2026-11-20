/** v-trace.test.ts - Weighted-sum definition, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { vTraceTargets } from "./v-trace";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[];
    values: number[];
    nextValues: number[];
    probs: number[];
    targetProbs: number[];
    gamma: number;
    rhoBar: number;
    cBar: number;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
    });
}

/** Independent weighted-sum form of the V-trace target. */
function reference(input: Input): number[] {
    const T = input.rewards.length;
    const rho = input.probs.map((mu, t) =>
        Math.min(input.rhoBar, (input.targetProbs[t] ?? 0) / (mu || 1)),
    );
    const c = input.probs.map((mu, t) => Math.min(input.cBar, (input.targetProbs[t] ?? 0) / (mu || 1)));
    const out: number[] = [];
    for (let t = 0; t < T; t += 1) {
        let sum = 0;
        let product = 1;
        for (let i = t; i < T; i += 1) {
            const delta = (rho[i] ?? 0) *
                ((input.rewards[i] ?? 0) + input.gamma * (input.nextValues[i] ?? 0) - (input.values[i] ?? 0));
            sum += Math.pow(input.gamma, i - t) * product * delta;
            product *= c[i] ?? 0;
        }
        out.push((input.values[t] ?? 0) + sum);
    }
    return out;
}

describe("V-trace", () => {
    const input = mod.defaultInput as Input;

    it("matches the weighted-sum definition", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rewards.length);
        const got = frames[frames.length - 1]?.meta["targets"] as number[];
        const expected = reference(input);
        expected.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 10));
    });

    it("reduces to the plain multi-step target with matching policies", () => {
        const matching = {
            ...input,
            probs: [0.5, 0.5, 0.5],
            targetProbs: [0.5, 0.5, 0.5],
            rhoBar: 1,
            cBar: 1,
        };
        const targets = vTraceTargets(matching);
        const expected = reference(matching);
        targets.forEach((s, i) => expect(s.target).toBeCloseTo(expected[i] ?? 0, 10));
    });

    it("enforces both truncation caps", () => {
        const steps = vTraceTargets({ ...input, probs: [0.1, 0.1, 0.1], targetProbs: [0.9, 0.9, 0.9], rhoBar: 2, cBar: 1 });
        steps.forEach((s) => {
            expect(s.rho).toBeLessThanOrEqual(2);
            expect(s.c).toBeLessThanOrEqual(1);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
