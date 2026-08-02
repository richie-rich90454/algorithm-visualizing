/**
 * lca-binary-lifting.test.ts – Minimum viable test for LCA (Binary Lifting).
 */

import { describe, expect, it } from "vitest";
import lcaBinaryLifting from "./lca-binary-lifting";

describe("LcaBinaryLifting", () => {
    it("yields at least one frame", () => {
        const generator = lcaBinaryLifting.run(lcaBinaryLifting.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lcaBinaryLifting.run(lcaBinaryLifting.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
