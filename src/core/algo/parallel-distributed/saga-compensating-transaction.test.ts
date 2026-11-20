/**
 * saga-compensating-transaction.test.ts - Exhaustive undo invariant, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateSaga } from "./saga-compensating-transaction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Saga Compensating Transaction", () => {
    it("exhaustively verifies the undo invariant for every failure point", () => {
        for (let steps = 1; steps <= 8; steps += 1) {
            const total = (steps * (steps + 1)) / 2;
            for (let failAt = 0; failAt <= steps + 1; failAt += 1) {
                const data = simulateSaga(steps, failAt);
                const expectedBalance = failAt >= 1 && failAt <= steps ? 0 : total;
                expect(data.balance).toBe(expectedBalance);
                expect(data.contributions.reduce((a, b) => a + b, 0)).toBe(expectedBalance);
                if (failAt >= 1 && failAt <= steps) {
                    const expectedOrder = Array.from({ length: failAt - 1 }, (_, i) => failAt - 1 - i);
                    expect(data.compensatedOrder).toEqual(expectedOrder);
                    expect(data.states[failAt - 1]).toBe("error");
                    for (let i = 0; i < failAt - 1; i += 1) {
                        expect(data.states[i]).toBe("swapped");
                    }
                } else {
                    expect(data.compensatedOrder).toEqual([]);
                    expect(data.states.every((s) => s === "sorted")).toBe(true);
                }
                const frames = [...mod.run({ steps, failAt })];
                checkFrames(frames, steps);
            }
        }
    });

    it("reports the final balance and reverse compensation order in metadata", () => {
        const frames = [...mod.run(mod.defaultInput as { steps: number; failAt: number })];
        checkFrames(frames, 5);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["balance"]).toBe(0);
        expect(final?.["compensatedOrder"]).toEqual([2, 1]);
        expect(final?.["failed"]).toBe(true);
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
