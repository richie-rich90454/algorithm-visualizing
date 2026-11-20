/**
 * levenshtein-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./levenshtein-coding";
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

/** Independent recursive Levenshtein encoder. */
function referenceEncode(n: number): string {
    if (n === 0) {
        return "0";
    }
    const binary = n.toString(2);
    return "1" + referenceEncode(binary.length - 1) + binary.slice(1);
}

/** Independent reference decoder for a concatenated stream. */
function referenceDecode(bits: string): number[] {
    let position = 0;
    const read = (): { value: number; next: number } => {
        if (bits[position] === "0") {
            position += 1;
            return { value: 0, next: position - 1 };
        }
        position += 1;
        const magnitude = read();
        const payload = bits.slice(magnitude.next + 1, magnitude.next + 1 + magnitude.value);
        const low = payload.length === magnitude.value ? parseInt(payload || "0", 2) : 0;
        position += magnitude.value;
        return { value: 2 ** magnitude.value + low, next: position - 1 };
    };
    const out: number[] = [];
    while (position < bits.length) {
        out.push(read().value);
    }
    return out;
}

describe("Levenshtein coding", () => {
    it("round-trips values and matches an independent encoder", () => {
        const values = [0, 1, 2, 3, 4, 5, 8, 15, 31];
        const frames = [...mod.run({ numbers: values })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["roundTrip"]).toBe(true);
        const bits = final["bits"] as string;
        expect(bits).toBe(values.map(referenceEncode).join(""));
        expect(referenceDecode(bits)).toEqual(values);
    });

    it("is prefix-free across a wide range of integers", () => {
        const codes = Array.from({ length: 300 }, (_, i) => referenceEncode(i));
        const sorted = [...codes].sort();
        for (let i = 1; i < sorted.length; i += 1) {
            expect((sorted[i] as string).startsWith(sorted[i - 1] as string)).toBe(false);
        }
    });

    it("has universal length about n plus two times log n", () => {
        for (const n of [1, 8, 64, 1024]) {
            const length = referenceEncode(n).length;
            expect(length).toBeLessThanOrEqual(n + 2 * Math.floor(Math.log2(n)) + 2);
            expect(length).toBeGreaterThanOrEqual(Math.floor(Math.log2(n)) + 1);
        }
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
