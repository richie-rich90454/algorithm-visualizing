/**
 * min-enclosing-circle-welzl.test.ts – Minimum viable test for Welzl.
 */

import { describe, expect, it } from "vitest";
import minEnclosingCircleWelzl from "./min-enclosing-circle-welzl";

describe("MinEnclosingCircleWelzl", () => {
    it("yields at least one frame", () => {
        const generator = minEnclosingCircleWelzl.run(minEnclosingCircleWelzl.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = minEnclosingCircleWelzl.run(minEnclosingCircleWelzl.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
