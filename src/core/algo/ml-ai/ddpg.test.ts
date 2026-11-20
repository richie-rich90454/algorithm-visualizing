/** ddpg.test.ts - Independent update replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ddpg";
import type { VisualFrame } from "@/types";

interface Input {
    state: number;
    nextState: number;
    reward: number;
    gamma: number;
    criticRate: number;
    actorRate: number;
    tau: number;
    steps: number;
    w: number[];
    theta: number;
}

const qValue = (w: number[], action: number, state: number) => (w[0] ?? 0) * action + (w[1] ?? 0) * state;

/** Independent replay of a linear-critic DDPG step. */
function reference(input: Input) {
    const w = [input.w[0] ?? 0, input.w[1] ?? 0];
    const wTarget = [...w];
    let theta = input.theta;
    let thetaTarget = theta;
    for (let i = 0; i < input.steps; i += 1) {
        const action = theta * input.state;
        const q = qValue(w, action, input.state);
        const y = input.reward + input.gamma * qValue(wTarget, thetaTarget * input.nextState, input.nextState);
        const error = y - q;
        w[0] = (w[0] ?? 0) + input.criticRate * error * action;
        w[1] = (w[1] ?? 0) + input.criticRate * error * input.state;
        theta += input.actorRate * (w[0] ?? 0) * input.state;
        wTarget[0] = input.tau * (w[0] ?? 0) + (1 - input.tau) * (wTarget[0] ?? 0);
        wTarget[1] = input.tau * (w[1] ?? 0) + (1 - input.tau) * (wTarget[1] ?? 0);
        thetaTarget = input.tau * theta + (1 - input.tau) * thetaTarget;
    }
    return { w, wTarget, theta, thetaTarget };
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
    });
}

describe("DDPG", () => {
    it("matches an independent replay of online and target parameters", () => {
        const cases: Input[] = [
            { state: 1, nextState: 0.8, reward: 1, gamma: 0.9, criticRate: 0.1, actorRate: 0.1, tau: 0.05, steps: 8, w: [0.5, 0.2], theta: 0.3 },
            { state: -1.5, nextState: 2, reward: -0.5, gamma: 0.5, criticRate: 0.2, actorRate: 0.05, tau: 0.2, steps: 5, w: [1, -1], theta: 0.7 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["w"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.w[i]!, 5));
            (final?.["wTarget"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.wTarget[i]!, 5));
            expect(final?.["theta"]).toBeCloseTo(expected.theta, 5);
            expect(final?.["thetaTarget"]).toBeCloseTo(expected.thetaTarget, 5);
        }
    });

    it("moves targets slowly toward the online weights", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const first = frames[1]?.meta;
        const w = first?.["w"] as number[];
        const wTarget = first?.["wTarget"] as number[];
        const tau = input.tau;
        expect(wTarget[0]!).toBeCloseTo(tau * w[0]! + (1 - tau) * (input.w[0] ?? 0), 5);
        expect(Math.abs(wTarget[0]! - (w[0] ?? 0))).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
