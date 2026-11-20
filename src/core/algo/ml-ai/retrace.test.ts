/** retrace.test.ts - Backward recursion, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { retraceReturns } from "./retrace";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[];
    nextValues: number[];
    probs: number[];
    targetProbs: number[];
    gamma: number;
    lambda: number;
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

/** Independent backward recursion with explicit arrays. */
function reference(input: Input): number[] {
    const T = input.rewards.length;
    const c = input.probs.map((mu, t) => input.lambda * Math.min(1, (input.targetProbs[t] ?? 0) / (mu || 1)));
    const ret = new Array(T + 1).fill(0);
    ret[T] = input.nextValues[T - 1] ?? 0;
    for (let t = T - 1; t >= 0; t -= 1) {
        const vNext = input.nextValues[t] ?? 0;
        const nextC = c[t + 1] ?? 0;
        ret[t] = (input.rewards[t] ?? 0) + input.gamma * vNext + input.gamma * nextC * (ret[t + 1] - vNext);
    }
    return ret.slice(0, T);
}

describe("Retrace(lambda)", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent backward recursion", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rewards.length);
        const got = frames[frames.length - 1]?.meta["returns"] as number[];
        const expected = reference(input);
        expected.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 12));
        retraceReturns(input).forEach((s, i) => expect(got[i]).toBeCloseTo(s.ret, 12));
    });

    it("reduces to the ordinary bootstrapped return when lambda is zero", () => {
        const zeroLambda = { ...input, lambda: 0 };
        const got = retraceReturns(zeroLambda);
        got.forEach((s, i) => {
            const vNext = input.nextValues[i] ?? 0;
            expect(s.ret).toBeCloseTo((input.rewards[i] ?? 0) + input.gamma * vNext, 12);
        });
    });

    it("caps c at lambda when the target action is at least as likely", () => {
        const steps = retraceReturns({ ...input, probs: [0.2, 0.2, 0.2], targetProbs: [0.8, 0.8, 0.8] });
        steps.forEach((s) => expect(s.c).toBeCloseTo(input.lambda, 12));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
