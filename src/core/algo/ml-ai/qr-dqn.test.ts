/** qr-dqn.test.ts - Independent quantile loss reference, level spacing, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { quantileHuber, quantileLevels } from "./qr-dqn";
import type { VisualFrame } from "@/types";

interface Input {
    reward: number;
    gamma: number;
    done: boolean;
    nextQuantiles: number[];
    currentQuantiles: number[];
    kappa: number;
}

function checkFrames(frames: VisualFrame[], N: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(N);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["N"]).toBe(N);
    });
}

/** Independent double-sum implementation of the QR-DQN objective. */
function reference(input: Input): number {
    const n = input.currentQuantiles.length;
    let total = 0;
    for (let i = 0; i < n; i += 1) {
        const tau = (2 * i + 1) / (2 * n);
        for (let j = 0; j < n; j += 1) {
            const target = input.reward + (input.done ? 0 : input.gamma * input.nextQuantiles[j]!);
            const residual = target - input.currentQuantiles[i]!;
            const magnitude = Math.abs(residual);
            const huber = magnitude < input.kappa
                ? (0.5 * residual * residual) / input.kappa
                : magnitude - 0.5 * input.kappa;
            total += Math.abs(tau - (residual < 0 ? 1 : 0)) * huber;
        }
    }
    return total / (n * n);
}

describe("QR-DQN", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent double-sum quantile loss reference", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.currentQuantiles.length + 2);
        checkFrames(frames, input.currentQuantiles.length);
        expect(Number(frames.at(-1)!.meta["loss"])).toBeCloseTo(reference(input), 10);
    });

    it("uses evenly spaced quantile midlevels", () => {
        const levels = quantileLevels(8);
        levels.forEach((tau, i) => expect(tau).toBeCloseTo((2 * i + 1) / 16, 12));
        expect(levels.every((v) => v > 0 && v < 1)).toBe(true);
        expect(levels.reduce((a, b) => a + b, 0)).toBeCloseTo(4, 10);
    });

    it("gives zero loss when every prediction matches a point-mass target", () => {
        const terminal = { ...input, done: true };
        const perfect = {
            ...terminal,
            currentQuantiles: terminal.nextQuantiles.map(() => input.reward),
        };
        expect(reference(perfect)).toBeCloseTo(0, 12);
        expect(Number([...mod.run(perfect)].at(-1)!.meta["loss"])).toBeCloseTo(0, 12);
        const meta = [...mod.run(terminal)].at(-1)!.meta;
        const targets = meta["targets"] as number[];
        targets.forEach((t) => expect(t).toBeCloseTo(input.reward, 12));
    });

    it("keeps the asymmetric Huber term nonnegative", () => {
        for (const tau of quantileLevels(8)) {
            for (const residual of [-5, -0.2, 0, 0.2, 5]) {
                expect(quantileHuber(tau, residual, 1)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.currentQuantiles.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
