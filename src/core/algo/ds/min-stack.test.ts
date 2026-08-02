/**
 * min-stack.test.ts – Minimum viable test for Min Stack.
 */

import { describe, expect, it } from "vitest";
import minStack from "./min-stack";

describe("MinStack", () => {
    it("yields at least one frame", () => {
        const generator = minStack.run(minStack.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = minStack.run(minStack.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
