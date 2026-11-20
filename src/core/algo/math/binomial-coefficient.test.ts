/**
 * binomial-coefficient.test.ts - Factorial-ratio cross-check with Pascal's
 * identity, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./binomial-coefficient";
import type { VisualFrame } from "@/types";

/** Independent reference using Pascal's recurrence on exact BigInts. */
function reference(n: number, k: number): bigint {
    if (k < 0 || k > n) {
        return 0n;
    }
    const row = new Array<bigint>(n + 1).fill(0n);
    row[0] = 1n;
    for (let i = 1; i <= n; i += 1) {
        for (let j = i; j >= 1; j -= 1) {
            row[j] = (row[j] as bigint) + (row[j - 1] as bigint);
        }
    }
    return row[k] as bigint;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Binomial Coefficient (Exact)", () => {
    it("matches Pascal's triangle on many inputs", () => {
        for (let n = 0; n <= 12; n += 1) {
            for (let k = 0; k <= n; k += 1) {
                const frames = [...mod.run({ n, k })];
                checkFrames(frames);
                const final = frames[frames.length - 1] as VisualFrame;
                expect(final.meta["value"]).toBe(reference(n, k).toString());
            }
        }
    });

    it("handles large coefficients exactly", () => {
        const frames = [...mod.run({ n: 100, k: 50 })];
        const final = frames[frames.length - 1] as VisualFrame;
        expect(final.meta["value"]).toBe(reference(100, 50).toString());
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
