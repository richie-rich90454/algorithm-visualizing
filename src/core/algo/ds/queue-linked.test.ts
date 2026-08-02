/**
 * queue-linked.test.ts – Minimum viable test for Queue (linked).
 */

import { describe, expect, it } from "vitest";
import queueLinked from "./queue-linked";

describe("QueueLinked", () => {
    it("yields at least one frame", () => {
        const generator = queueLinked.run(queueLinked.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = queueLinked.run(queueLinked.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
