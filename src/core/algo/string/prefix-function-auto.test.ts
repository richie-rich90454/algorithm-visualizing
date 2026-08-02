/**
 * prefix-function-auto.test.ts – Minimum viable test for the automaton.
 */

import { describe, expect, it } from "vitest";
import prefixFunctionAuto from "./prefix-function-auto";

describe("PrefixFunctionAuto", () => {
    it("yields at least one frame", () => {
        const generator = prefixFunctionAuto.run(prefixFunctionAuto.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = prefixFunctionAuto.run(prefixFunctionAuto.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
