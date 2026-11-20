/**
 * leaky-bucket-rate-limiter.test.ts - Independent simulation, bounds, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./leaky-bucket-rate-limiter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], arrivals: number[], capacity: number): void {
    expect(frames.length).toBe(arrivals.length + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(arrivals.length + capacity);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(Math.max(arrivals.length, capacity));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent leaky-bucket simulation. */
function reference(capacity: number, interval: number, arrivals: number[]): boolean[] {
    let queue = 0;
    let nextDrain = interval;
    const result: boolean[] = [];
    for (const time of arrivals) {
        while (nextDrain <= time + 1e-12) {
            if (queue > 0) {
                queue -= 1;
            }
            nextDrain += interval;
        }
        const allowed = queue < capacity;
        if (allowed) {
            queue += 1;
        }
        result.push(allowed);
    }
    return result;
}

describe("Leaky bucket rate limiter", () => {
    it("matches an independent simulation for several configurations", () => {
        const cases: Array<{ capacity: number; drainInterval: number; arrivals: number[] }> = [
            { capacity: 3, drainInterval: 1, arrivals: [0, 0.5, 1, 1.2, 1.5, 2, 2.1, 3] },
            { capacity: 1, drainInterval: 2, arrivals: [0, 0, 0, 2, 2, 4] },
            { capacity: 4, drainInterval: 0.5, arrivals: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.arrivals, testCase.capacity);
            const meta = frames[frames.length - 1]?.meta;
            const want = reference(testCase.capacity, testCase.drainInterval, testCase.arrivals);
            expect(meta?.["decisions"]).toEqual(want.map((d) => (d ? 1 : 0)));
            expect(Number(meta?.["accepted"]) + Number(meta?.["rejected"])).toBe(testCase.arrivals.length);
        }
    });

    it("keeps the queue within bounds for a long arrival stream", () => {
        const arrivals = Array.from({ length: 60 }, (_, i) => i * 0.1);
        const frames = [...mod.run({ capacity: 5, drainInterval: 1, arrivals })];
        checkFrames(frames, arrivals, 5);
        for (const frame of frames) {
            const queue = Number(frame.meta["queue"]);
            expect(queue).toBeGreaterThanOrEqual(0);
            expect(queue).toBeLessThanOrEqual(5);
        }
    });

    it("rejects everything beyond capacity when no time passes", () => {
        const frames = [...mod.run({ capacity: 2, drainInterval: 1, arrivals: [0, 0, 0, 0] })];
        checkFrames(frames, [0, 0, 0, 0], 2);
        expect(frames[frames.length - 1]?.meta["decisions"]).toEqual([1, 1, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
