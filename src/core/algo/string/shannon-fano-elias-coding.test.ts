/**
 * shannon-fano-elias-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./shannon-fano-elias-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], symbolCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(symbolCount);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** First `length` bits of the binary fraction of x, computed independently. */
function fractionBits(x: number, length: number): string {
    let value = x;
    let out = "";
    for (let i = 0; i < length; i += 1) {
        value *= 2;
        out += value >= 1 ? "1" : "0";
        if (value >= 1) {
            value -= 1;
        }
    }
    return out;
}

function isPrefixFree(codes: string[]): boolean {
    for (let i = 0; i < codes.length; i += 1) {
        for (let j = 0; j < codes.length; j += 1) {
            if (i !== j && (codes[j] as string).startsWith(codes[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

describe("Shannon-Fano-Elias coding", () => {
    it("uses midpoint binary fractions with the expected lengths", () => {
        const input = { symbols: ["a", "b", "c"], weights: [0.5, 0.25, 0.25] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]!.meta;
        expect(final["prefixFree"]).toBe(true);
        expect(final["roundTrip"]).toBe(true);

        const expected = [
            { symbol: "a", midpoint: 0.25, length: 2 },
            { symbol: "b", midpoint: 0.625, length: 3 },
            { symbol: "c", midpoint: 0.875, length: 3 },
        ];
        for (const entry of expected) {
            const entity = frames[0]!.entities.find((e) => e.value === entry.symbol);
            expect(entity?.metadata["code"]).toBe(fractionBits(entry.midpoint, entry.length));
            expect(entity?.metadata["code"]).toHaveLength(entry.length);
        }
        const codes = frames[0]!.entities.map((e) => e.metadata["code"] as string);
        expect(isPrefixFree(codes)).toBe(true);
        expect(final["kraft"]).toBeLessThanOrEqual(1 + 1e-9);
    });

    it("round-trips several skewed distributions", () => {
        const cases = [
            [0.7, 0.2, 0.1],
            [0.4, 0.3, 0.2, 0.1],
            [0.9, 0.05, 0.03, 0.02],
        ];
        for (const weights of cases) {
            const symbols = weights.map((_, i) => `s${i}`);
            const frames = [...mod.run({ symbols, weights })];
            checkFrames(frames, weights.length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["prefixFree"]).toBe(true);
            expect(final["roundTrip"]).toBe(true);
        }
    });

    it("gives shorter codes to more probable symbols", () => {
        const frames = [...mod.run({ symbols: ["a", "b", "c", "d"], weights: [0.7, 0.2, 0.07, 0.03] })];
        const lengths = frames[0]!.entities.map((e) => (e.metadata["code"] as string).length);
        expect(lengths[0]!).toBeLessThanOrEqual(lengths[1] as number);
        expect(lengths[1]!).toBeLessThanOrEqual(lengths[2] as number);
        expect(lengths[2]!).toBeLessThanOrEqual(lengths[3] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
