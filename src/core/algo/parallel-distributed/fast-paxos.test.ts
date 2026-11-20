/**
 * fast-paxos.test.ts - Fast-quorum and recovery property checks, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateFastPaxos } from "./fast-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], acceptors: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(acceptors);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fast Paxos", () => {
    it("matches an independent fast-quorum and recovery computation", () => {
        for (let n = 1; n <= 6; n += 1) {
            for (let fq = 1; fq <= n; fq += 1) {
                for (let accepts = 0; accepts <= n; accepts += 1) {
                    for (const conflicts of [[], [9], [9, 2], [1, 3, 5]]) {
                        if (accepts + conflicts.length > n) continue;
                        const value = 7;
                        const data = simulateFastPaxos(n, fq, value, accepts, conflicts);
                        const expectedFast = accepts >= fq;
                        const candidates = [...conflicts];
                        if (accepts > 0) candidates.push(value);
                        const expectedRecovery = candidates.length ? Math.max(...candidates) : -1;
                        expect(data.fastChosen).toBe(expectedFast);
                        expect(data.recoveryValue).toBe(expectedRecovery);
                        expect(data.finalValue).toBe(expectedFast ? value : expectedRecovery);
                        expect(data.held.length).toBe(n);
                        expect(data.held.filter((v) => v === value).length).toBe(data.accepts);
                        expect(data.accepts + data.conflicts + data.silent).toBe(n);
                    }
                }
            }
        }
    });

    it("shows a recovery frame only when the fast quorum is missed", () => {
        const fast = [...mod.run({ acceptors: 5, fastQuorum: 4, value: 7, accepts: 4, conflictValues: [9] })];
        const slow = [...mod.run({ acceptors: 5, fastQuorum: 4, value: 7, accepts: 3, conflictValues: [9, 2] })];
        checkFrames(fast, 5);
        expect(fast.length).toBe(3);
        expect(fast[fast.length - 1]?.meta["finalValue"]).toBe(7);
        checkFrames(slow, 5);
        expect(slow.length).toBe(4);
        expect(slow[slow.length - 1]?.meta["finalValue"]).toBe(9);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
