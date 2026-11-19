/** td3.test.ts - Independent replay with seeded noise, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./td3";
import type { VisualFrame } from "@/types";

interface Input {
    state: number;
    nextState: number;
    reward: number;
    gamma: number;
    criticRate: number;
    actorRate: number;
    tau: number;
    policyDelay: number;
    noiseStd: number;
    steps: number;
    w1: number[];
    w2: number[];
    theta: number;
    seed: number;
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
function gaussian(random: () => number): number {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const qValue = (w: number[], a: number, s: number) => (w[0] ?? 0) * a + (w[1] ?? 0) * s;
const clamp = (v: number, c: number) => Math.min(c, Math.max(-c, v));

/** Independent replay of TD3 including the exact same seeded noise sequence. */
function reference(input: Input) {
    const w1 = [input.w1[0] ?? 0, input.w1[1] ?? 0];
    const w2 = [input.w2[0] ?? 0, input.w2[1] ?? 0];
    const w1Target = [...w1];
    const w2Target = [...w2];
    let theta = input.theta;
    let thetaTarget = theta;
    const random = mulberry32(input.seed);
    for (let i = 1; i <= input.steps; i += 1) {
        const action = theta * input.state;
        const q1 = qValue(w1, action, input.state);
        const q2 = qValue(w2, action, input.state);
        const noise = clamp(gaussian(random) * input.noiseStd, 0.5);
        const targetAction = thetaTarget * input.nextState + noise;
        const y = input.reward + input.gamma * Math.min(qValue(w1Target, targetAction, input.nextState), qValue(w2Target, targetAction, input.nextState));
        w1[0] = (w1[0] ?? 0) + input.criticRate * (y - q1) * action;
        w1[1] = (w1[1] ?? 0) + input.criticRate * (y - q1) * input.state;
        w2[0] = (w2[0] ?? 0) + input.criticRate * (y - q2) * action;
        w2[1] = (w2[1] ?? 0) + input.criticRate * (y - q2) * input.state;
        if (i % input.policyDelay === 0) {
            theta += input.actorRate * (w1[0] ?? 0) * input.state;
            w1Target[0] = input.tau * (w1[0] ?? 0) + (1 - input.tau) * (w1Target[0] ?? 0);
            w1Target[1] = input.tau * (w1[1] ?? 0) + (1 - input.tau) * (w1Target[1] ?? 0);
            w2Target[0] = input.tau * (w2[0] ?? 0) + (1 - input.tau) * (w2Target[0] ?? 0);
            w2Target[1] = input.tau * (w2[1] ?? 0) + (1 - input.tau) * (w2Target[1] ?? 0);
            thetaTarget = input.tau * theta + (1 - input.tau) * thetaTarget;
        }
    }
    return { w1, w2, w1Target, w2Target, theta, thetaTarget };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const noise = Number(frame.meta["noise"]);
        expect(Math.abs(noise)).toBeLessThanOrEqual(0.5 + 1e-9);
    });
}

describe("TD3", () => {
    it("matches an independent replay of twin critics and delayed updates", () => {
        const cases: Input[] = [
            { state: 1, nextState: 0.8, reward: 1, gamma: 0.99, criticRate: 0.1, actorRate: 0.1, tau: 0.05, policyDelay: 2, noiseStd: 0.2, steps: 8, w1: [0.5, 0.2], w2: [0.4, 0.3], theta: 0.3, seed: 11 },
            { state: -1, nextState: 1.5, reward: -1, gamma: 0.5, criticRate: 0.2, actorRate: 0.15, tau: 0.3, policyDelay: 3, noiseStd: 0.5, steps: 10, w1: [1, -1], w2: [-0.5, 0.7], theta: 0.2, seed: 42 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["w1"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.w1[i]!, 5));
            (final?.["w2"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.w2[i]!, 5));
            (final?.["w1Target"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.w1Target[i]!, 5));
            (final?.["w2Target"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.w2Target[i]!, 5));
            expect(final?.["theta"]).toBeCloseTo(expected.theta, 5);
            expect(final?.["thetaTarget"]).toBeCloseTo(expected.thetaTarget, 5);
        }
    });

    it("updates the actor only on delayed steps", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const step1 = frames[1]?.meta;
        const step2 = frames[2]?.meta;
        expect(step1?.["delayed"]).toBe(false);
        expect(step2?.["delayed"]).toBe(true);
        expect(step1?.["theta"]).toBeCloseTo(input.theta, 6);
        expect(Number(step2?.["theta"])).not.toBeCloseTo(input.theta, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
