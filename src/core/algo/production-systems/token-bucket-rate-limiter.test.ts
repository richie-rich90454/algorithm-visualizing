/**
 * token-bucket-rate-limiter.test.ts - Independent simulation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./token-bucket-rate-limiter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], arrivals: number[]): void {
    expect(frames.length).toBe(arrivals.length + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(arrivals.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(arrivals.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference simulation written as a straightforward loop. */
function reference(capacity: number, rate: number, arrivals: number[]): boolean[] {
    let tokens = capacity;
    let previous = 0;
    const result: boolean[] = [];
    for (const time of arrivals) {
        tokens = Math.min(capacity, tokens + Math.max(0, time - previous) * rate);
        result.push(tokens >= 1);
        if (tokens >= 1) {
            tokens -= 1;
        }
        previous = time;
    }
    return result;
}

describe("TokenBucketRateLimiter", () => {
    it("matches an independent simulation for several configurations", () => {
        const cases: Array<{ capacity: number; refillRate: number; arrivals: number[] }> = [
            { capacity: 2, refillRate: 1, arrivals: [0, 0.2, 0.5, 1, 1.1, 1.2, 2, 2.5] },
            { capacity: 1, refillRate: 0.5, arrivals: [0, 0, 0, 1, 2, 3, 4] },
            { capacity: 5, refillRate: 2, arrivals: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
            { capacity: 3, refillRate: 0, arrivals: [0, 1, 2] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.arrivals);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["decisions"]).toEqual(
                reference(testCase.capacity, testCase.refillRate, testCase.arrivals).map((d) =>
                    d ? 1 : 0,
                ),
            );
            expect(Number(meta?.["allowed"]) + Number(meta?.["denied"])).toBe(testCase.arrivals.length);
        }
    });

    it("never lets the token count leave its bounds", () => {
        const arrivals = Array.from({ length: 40 }, (_, i) => i * 0.05);
        const frames = [...mod.run({ capacity: 3, refillRate: 2, arrivals })];
        checkFrames(frames, arrivals);
        for (const frame of frames) {
            const tokens = Number(frame.meta["tokens"]);
            expect(tokens).toBeGreaterThanOrEqual(0);
            expect(tokens).toBeLessThanOrEqual(3);
        }
    });

    it("allows only a capacity-sized burst at one instant", () => {
        const frames = [...mod.run({ capacity: 3, refillRate: 1, arrivals: [0, 0, 0, 0, 0] })];
        checkFrames(frames, [0, 0, 0, 0, 0]);
        expect(frames[frames.length - 1]?.meta["decisions"]).toEqual([1, 1, 1, 0, 0]);
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
