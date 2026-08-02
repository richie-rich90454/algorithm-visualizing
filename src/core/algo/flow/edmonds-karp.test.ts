/**
 * edmonds-karp.test.ts – Minimum viable test for Edmonds-Karp.
 */

import { describe, expect, it } from "vitest";
import edmondsKarp from "./edmonds-karp";

describe("EdmondsKarp", () => {
    it("yields at least one frame", () => {
        const generator = edmondsKarp.run(edmondsKarp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = edmondsKarp.run(edmondsKarp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
