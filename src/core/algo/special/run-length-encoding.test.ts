/**
 * run-length-encoding.test.ts – Minimum viable test for RLE.
 */

import { describe, expect, it } from "vitest";
import runLengthEncoding from "./run-length-encoding";

describe("RunLengthEncoding", () => {
    it("yields at least one frame", () => {
        const generator = runLengthEncoding.run(runLengthEncoding.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = runLengthEncoding.run(runLengthEncoding.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
