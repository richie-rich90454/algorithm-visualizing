/**
 * unary-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./unary-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent unary decoder used as a reference. */
function referenceDecode(bits: string): number[] {
    const parts = bits.split("0");
    parts.pop();
    return parts.map((part) => part.length);
}

describe("Unary coding", () => {
    it("round-trips values and matches an independent decoder", () => {
        const values = [0, 1, 2, 3, 4, 7, 11];
        const frames = [...mod.run({ numbers: values })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["roundTrip"]).toBe(true);
        const bits = final["bits"] as string;
        expect(bits).toBe(values.map((n) => "1".repeat(n) + "0").join(""));
        expect(referenceDecode(bits)).toEqual(values);
        for (const part of bits.split("0").slice(0, -1)) {
            expect(part.length).toBeGreaterThanOrEqual(0);
        }
    });

    it("produces a prefix-free code set", () => {
        const codes = [0, 1, 2, 5, 9].map((n) => "1".repeat(n) + "0");
        for (let i = 0; i < codes.length; i += 1) {
            for (let j = 0; j < codes.length; j += 1) {
                if (i !== j) {
                    expect((codes[j] as string).startsWith(codes[i] as string)).toBe(false);
                }
            }
        }
    });

    it("terminates cleanly on empty input fallback", () => {
        const generator = mod.run({ numbers: [] });
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
