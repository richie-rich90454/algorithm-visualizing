/**
 * shell-sort.test.ts – Minimum viable test for Shell Sort.
 */

import { describe, expect, it } from "vitest";
import shellSort from "./shell-sort";

describe("ShellSort", () => {
    it("yields at least one frame", () => {
        const generator = shellSort.run(shellSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = shellSort.run(shellSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
