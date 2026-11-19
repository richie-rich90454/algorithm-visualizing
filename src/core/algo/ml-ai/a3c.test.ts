/** a3c.test.ts - Independent delta replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./a3c";
import type { VisualFrame } from "@/types";

interface Worker { s: number; a: number; r: number; sp: number }
interface Input {
    numStates: number;
    numActions: number;
    initV: number[];
    initTheta: number[];
    workers: Worker[];
    gamma: number;
    lrV: number;
    lrA: number;
}
function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / sum);
}

/** Independent replay of asynchronous worker deltas applied to shared parameters. */
function reference(input: Input) {
    const v = Array.from({ length: input.numStates }, (_, i) => input.initV[i] ?? 0);
    const theta = Array.from({ length: input.numActions }, (_, i) => input.initTheta[i] ?? 0);
    for (const worker of input.workers) {
        const readV = [...v];
        const readTheta = [...theta];
        const advantage = worker.r + input.gamma * (readV[worker.sp] ?? 0) - (readV[worker.s] ?? 0);
        const probs = softmax(readTheta);
        const localV = [...readV];
        const localTheta = [...readTheta];
        localV[worker.s] = (localV[worker.s] ?? 0) + input.lrV * advantage;
        for (let a = 0; a < input.numActions; a += 1) {
            localTheta[a] = (localTheta[a] ?? 0) + input.lrA * advantage * ((a === worker.a ? 1 : 0) - (probs[a] ?? 0));
        }
        for (let i = 0; i < input.numStates; i += 1) v[i] = (v[i] ?? 0) + ((localV[i] ?? 0) - (readV[i] ?? 0));
        for (let i = 0; i < input.numActions; i += 1) theta[i] = (theta[i] ?? 0) + ((localTheta[i] ?? 0) - (readTheta[i] ?? 0));
    }
    return { v, theta };
}

function checkFrames(frames: VisualFrame[], states: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(states);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const policy = frame.meta["policy"] as number[];
        expect(policy.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 6);
    });
}

describe("A3C", () => {
    it("matches an independent replay of pushed worker deltas", () => {
        const cases: Input[] = [
            { numStates: 4, numActions: 3, initV: [0, 0, 0, 0], initTheta: [0, 0, 0], workers: [{ s: 0, a: 0, r: 0, sp: 1 }, { s: 1, a: 1, r: 0, sp: 2 }, { s: 2, a: 2, r: 1, sp: 3 }], gamma: 0.9, lrV: 0.2, lrA: 0.1 },
            { numStates: 3, numActions: 2, initV: [1, -1, 0.5], initTheta: [0.5, -0.2], workers: [{ s: 0, a: 1, r: 2, sp: 2 }, { s: 1, a: 0, r: -1, sp: 0 }, { s: 2, a: 1, r: 0.5, sp: 1 }], gamma: 0.5, lrV: 0.3, lrA: 0.2 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.numStates);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["v"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.v[i]!, 5));
            (final?.["theta"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.theta[i]!, 5));
        }
    });

    it("global values change only by the sum of pushed deltas", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const initialV = frames[0]?.meta["v"] as number[];
        const finalV = frames[frames.length - 1]?.meta["v"] as number[];
        const deltas = frames.slice(1, -1).map((f) => f.meta["deltaV"] as number[]);
        for (let i = 0; i < input.numStates; i += 1) {
            const expected = (initialV[i] ?? 0) + deltas.reduce((sum, d) => sum + (d[i] ?? 0), 0);
            expect(finalV[i]).toBeCloseTo(expected, 5);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
