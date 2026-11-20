/**
 * deep-q-network.test.ts - Bellman target reference, descent check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./deep-q-network";
import type { VisualFrame } from "@/types";

type Vector = number[];
interface Input {
    w: Vector;
    phiS: Vector[];
    phiSPrime: Vector[];
    action: number;
    reward: number;
    gamma: number;
    lr: number;
    done: boolean;
}
const dot = (a: Vector, b: Vector): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function checkFrames(frames: VisualFrame[], actions: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(actions + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DeepQNetwork (toy)", () => {
    it("computes the Bellman target exactly against an independent oracle", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.phiS.length);
        const nextQ = input.phiSPrime.map((phi) => dot(input.w, phi));
        const expectedTarget = input.reward + (input.done ? 0 : input.gamma * Math.max(...nextQ));
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        expect(Number(finalMeta["target"])).toBeCloseTo(expectedTarget, 9);
        const expectedQ = input.phiS.map((phi) => dot(input.w, phi));
        expect((frames[0]?.meta["qValues"] as number[]).map((v) => Number(v.toFixed(9)))).toEqual(expectedQ.map((v) => Number(v.toFixed(9))));
    });

    it("the gradient step reduces the squared TD error", () => {
        for (const action of [0, 1]) {
            const input = { ...(mod.defaultInput as Input), action };
            const frames = [...mod.run(input)];
            const before = Number(frames[1]?.meta["loss"]);
            const after = Number(frames[frames.length - 1]?.meta["loss"]);
            expect(before).toBeGreaterThan(0);
            expect(after).toBeLessThan(before);
            expect(Number(frames[frames.length - 1]?.meta["tdError"])).toBeLessThan(Number(frames[1]?.meta["tdError"]));
        }
    });

    it("terminal transitions omit the discounted future value", () => {
        const input = { ...(mod.defaultInput as Input), done: true, reward: 3 };
        const frames = [...mod.run(input)];
        expect(Number(frames[frames.length - 1]?.meta["target"])).toBe(3);
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
