/**
 * monotonic-queue.test.ts – Minimum viable test for Monotonic Queue.
 */

import { describe, expect, it } from "vitest";
import monotonicQueue from "./monotonic-queue";

describe("MonotonicQueue", () => {
    it("yields at least one frame", () => {
        const generator = monotonicQueue.run(monotonicQueue.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = monotonicQueue.run(monotonicQueue.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
