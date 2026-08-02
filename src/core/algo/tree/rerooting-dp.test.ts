/**
 * rerooting-dp.test.ts – Minimum viable test for Rerooting DP.
 */

import { describe, expect, it } from "vitest";
import rerootingDp from "./rerooting-dp";

describe("RerootingDp", () => {
    it("yields at least one frame", () => {
        const generator = rerootingDp.run(rerootingDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rerootingDp.run(rerootingDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
