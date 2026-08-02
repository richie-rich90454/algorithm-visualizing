/**
 * monotonic-queue-dp.test.ts – Minimum viable test for Monotonic Queue DP.
 */

import { describe, expect, it } from "vitest";
import monotonicQueueDp from "./monotonic-queue-dp";

describe("MonotonicQueueDp", () => {
    it("yields at least one frame", () => {
        const generator = monotonicQueueDp.run(monotonicQueueDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = monotonicQueueDp.run(monotonicQueueDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
