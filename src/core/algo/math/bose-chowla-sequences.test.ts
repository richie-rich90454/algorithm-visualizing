/** bose-chowla-sequences.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./bose-chowla-sequences";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bose-Chowla Sidon sequences", () => {
    it("produces genuine Sidon sets for several small primes", () => {
        for (const p of [3, 5, 7, 11, 13]) {
            const frames = [...mod.run({ p })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const sidon = final?.["sidonSet"] as number[];
            const modulus = final?.["modulus"] as number;
            expect(final?.["isSidon"]).toBe(true);
            expect(final?.["size"]).toBe(p);
            expect(modulus).toBe(p * p - 1);
            expect(sidon.length).toBe(p);
            expect(new Set(sidon).size).toBe(p);

            // Independent Sidon check: every unordered pair sum is distinct.
            const sums = new Set<number>();
            for (let i = 0; i < sidon.length; i += 1) {
                for (let j = i; j < sidon.length; j += 1) {
                    sums.add((sidon[i]! + sidon[j]!) % modulus);
                }
            }
            expect(sums.size).toBe((p * (p + 1)) / 2);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
