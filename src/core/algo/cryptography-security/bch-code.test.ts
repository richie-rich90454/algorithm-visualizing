/** bch-code.test.ts - Exhaustive codebook check, all one- and two-bit errors, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./bch-code";
import type { VisualFrame } from "@/types";

const GEN = 0x1d1;

function deg(v: number): number { return v <= 0 ? -1 : 31 - Math.clz32(v); }
function rem(v: number): number {
    let c = v;
    while (deg(c) >= deg(GEN)) { c ^= GEN << (deg(c) - deg(GEN)); }
    return c;
}
function encode(m: number): number { const s = (m & 0x7f) << 8; return s | rem(s); }

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("BchCode", () => {
    it("produces zero-remainder codewords for all 128 messages", () => {
        const seen = new Set<number>();
        for (let m = 0; m < 128; m += 1) {
            const codeword = encode(m);
            expect(rem(codeword)).toBe(0);
            expect((codeword >>> 8) & 0x7f).toBe(m);
            seen.add(codeword);
        }
        expect(seen.size).toBe(128);
    });

    it("corrects every single-bit error for every message", () => {
        for (let m = 0; m < 128; m += 1) {
            const cw = encode(m);
            for (let bit = 0; bit < 15; bit += 1) {
                const frames = [...mod.run({ message: m, errors: [bit] })];
                checkFrames(frames);
                expect(frames[frames.length - 1]?.meta["decodedMessage"]).toBe(m);
                expect(frames[frames.length - 1]?.meta["success"]).toBe(true);
            }
        }
    });

    it("corrects every two-bit error for every message", () => {
        for (let m = 0; m < 128; m += 1) {
            const cw = encode(m);
            for (let a = 0; a < 15; a += 1) {
                for (let b = a + 1; b < 15; b += 1) {
                    const received = cw ^ (1 << a) ^ (1 << b);
                    const frames = [...mod.run({ message: m, errors: [a, b] })];
                    expect(frames[frames.length - 1]?.meta["decodedMessage"]).toBe(m);
                    void received;
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
