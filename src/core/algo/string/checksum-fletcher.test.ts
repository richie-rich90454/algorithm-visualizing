/**
 * checksum-fletcher.test.ts - Independent algebraic check, frame shape,
 * error detection, and termination for the Fletcher checksum module.
 */

import { describe, expect, it } from "vitest";
import mod from "./checksum-fletcher";

/** Independent closed-form Fletcher result: s1 = sum bytes, s2 = weighted sum. */
function reference(bytes: number[], modulus: number): { s1: number; s2: number; checksum: number } {
    const n = bytes.length;
    let s1 = 0;
    let s2 = 0;
    for (let j = 0; j < n; j += 1) {
        s1 += bytes[j] ?? 0;
        s2 += (n - j) * (bytes[j] ?? 0);
    }
    s1 %= modulus;
    s2 %= modulus;
    return { s1, s2, checksum: ((s2 << 8) | s1) >>> 0 };
}

function toBytes(text: string): number[] {
    return Array.from(text, (character) => character.charCodeAt(0) & 0xff);
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Fletcher Checksum", () => {
    it("matches the closed-form sum and weighted sum on the default input", () => {
        const input = mod.defaultInput as { text: string };
        const bytes = toBytes(input.text);
        const expected = reference(bytes, 255);
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        expect(last?.meta.s1).toBe(expected.s1);
        expect(last?.meta.s2).toBe(expected.s2);
        expect(last?.meta.checksum).toBe(expected.checksum);
    });

    it("agrees with the closed form on random messages and moduli", () => {
        const random = seeded(918273);
        for (let trial = 0; trial < 80; trial += 1) {
            const length = Math.floor(random() * 30);
            const bytes = Array.from({ length }, () => Math.floor(random() * 256));
            const modulus = 4 + Math.floor(random() * 252);
            const expected = reference(bytes, modulus);
            const frames = [...mod.run({ bytes, modulus })];
            const last = frames[frames.length - 1];
            expect(last?.meta.s1, `trial ${trial}`).toBe(expected.s1);
            expect(last?.meta.s2, `trial ${trial}`).toBe(expected.s2);
            expect(last?.meta.checksum, `trial ${trial}`).toBe(expected.checksum);
        }
    });

    it("detects every single-byte change relative to the reference", () => {
        const bytes = [10, 20, 30, 40, 50];
        const original = reference(bytes, 255);
        for (let i = 0; i < bytes.length; i += 1) {
            const changed = [...bytes];
            changed[i] = (changed[i] ?? 0) + 1;
            const result = reference(changed, 255);
            expect(result.checksum).not.toBe(original.checksum);
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { text: string };
        const n = input.text.length;
        const frames = [...mod.run(input)];
        expect(frames).toHaveLength(n + 2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("grid");
            expect(frame.meta.rows).toBe(1);
            expect(frame.meta.cols).toBe(n);
            expect(frame.entities).toHaveLength(n);
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(n);
            for (const e of frame.entities) {
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
                expect(Number.isFinite(e.width)).toBe(true);
                expect(Number.isFinite(e.height)).toBe(true);
            }
        });
    });

    it("handles empty input", () => {
        const frames = [...mod.run({ bytes: [] })];
        expect(frames).toHaveLength(2);
        expect(frames[frames.length - 1]?.meta.checksum).toBe(0);
        expect(frames[0]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
