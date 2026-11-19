/**
 * rate-limit-sliding-window.test.ts - Quota, brute-force agreement, frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rate-limit-sliding-window";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("rate-limit-sliding-window");
    });
}

/** Independent recomputation of sliding window decisions. */
function reference(timestamps: number[], window: number, limit: number) {
    const admitted: number[] = [];
    const decisions: number[] = [];
    const counts: number[] = [];
    for (const t of timestamps) {
        const count = admitted.filter((s) => s > t - window && s <= t).length;
        counts.push(count);
        if (count < limit) {
            admitted.push(t);
            decisions.push(1);
        } else {
            decisions.push(0);
        }
    }
    return { decisions, counts, admitted };
}

describe("Sliding Window Rate Limit", () => {
    it("matches an independent limiter and respects the quota", () => {
        const input = { timestamps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], window: 4, limit: 3 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.timestamps.length);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(input.timestamps, input.window, input.limit);
        expect(meta?.["decisions"]).toEqual(expected.decisions);
        expect(meta?.["counts"]).toEqual(expected.counts);
        expect(meta?.["admitted"]).toEqual(expected.admitted);
        (meta?.["counts"] as number[]).forEach((count) => expect(count).toBeLessThanOrEqual(input.limit));
    });

    it("avoids fixed-window boundary bursts on clustered traffic", () => {
        const timestamps = Array.from({ length: 20 }, (_, i) => i * 0.5);
        const frames = [...mod.run({ timestamps, window: 2, limit: 4 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["decisions"]).toEqual(reference(timestamps, 2, 4).decisions);
        const admitted = meta?.["admitted"] as number[];
        for (const t of admitted) {
            expect(admitted.filter((s) => s > t - 2 && s <= t).length).toBeLessThanOrEqual(4);
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
