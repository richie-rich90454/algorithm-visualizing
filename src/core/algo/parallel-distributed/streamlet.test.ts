/**
 * streamlet.test.ts - Notarization/finalization property checks, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateStreamlet, type StreamletEpoch } from "./streamlet";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], epochs: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(epochs);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference computation of notarized and finalized flags. */
function reference(schedule: StreamletEpoch[]) {
    const notarized = schedule.map(() => false);
    schedule.forEach((epoch, k) => {
        notarized[k] = epoch.parent === 0 ||
            (epoch.parent >= 1 && epoch.parent <= k && notarized[epoch.parent - 1] === true);
    });
    const finalized = schedule.map(() => false);
    schedule.forEach((_, k) => {
        if (!notarized[k]) return;
        finalized[k] = schedule.some((e, j) => j > k && notarized[j] && e.parent === k + 1);
    });
    return { notarized, finalized };
}

describe("Streamlet", () => {
    it("matches an independent reference across exhaustive parent schedules", () => {
        for (let n = 1; n <= 5; n += 1) {
            for (let trial = 0; trial < 200; trial += 1) {
                const schedule: StreamletEpoch[] = Array.from({ length: n }, (_, k) => ({
                    leader: trial % 4,
                    parent: (trial + k) % (k + 1),
                }));
                const expected = reference(schedule);
                const data = simulateStreamlet(schedule);
                expect(data.notarized).toEqual(expected.notarized);
                expect(data.finalized).toEqual(expected.finalized);
                for (let k = 0; k < n; k += 1) {
                    if (!data.finalized[k]) continue;
                    const parent = schedule[k]?.parent ?? -1;
                    expect(parent === 0 || data.finalized[parent - 1]).toBe(true);
                }
            }
        }
    });

    it("finalizes a straight chain but never the last unextended block", () => {
        const schedule: StreamletEpoch[] = Array.from({ length: 6 }, (_, i) => ({ leader: i, parent: i }));
        const data = simulateStreamlet(schedule);
        expect(data.notarized).toEqual([true, true, true, true, true, true]);
        expect(data.finalized).toEqual([true, true, true, true, true, false]);
        expect(data.finalizedChain).toEqual([1, 2, 3, 4, 5]);
        const frames = [...mod.run({ schedule })];
        checkFrames(frames, 6);
        expect(frames[frames.length - 1]?.meta["finalizedChain"]).toEqual([1, 2, 3, 4, 5]);
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
