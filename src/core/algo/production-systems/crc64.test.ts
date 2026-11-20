/**
 * crc64.test.ts - Published CRC-64/ECMA-182 check value, an independent
 * bitwise reference cross-check, burst-error detection, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod, { absorb, crc64, toBytes } from "./crc64";
import type { VisualFrame } from "@/types";

const MASK = 0xffffffffffffffffn;

/** Independent reference: MSB-first long division with the same generator. */
function reference(bytes: number[]): bigint {
    let register = 0n;
    for (const byte of bytes) {
        register ^= BigInt(byte) << 56n;
        for (let bit = 0; bit < 8; bit += 1) {
            register = register & 0x8000000000000000n
                ? (((register << 1n) & MASK) ^ 0x42f0e1eba9ea3693n)
                : ((register << 1n) & MASK);
        }
    }
    return register;
}

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBe(byteCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(byteCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CRC-64 Checksum", () => {
    it("matches the published ECMA-182 check value", () => {
        expect(crc64(toBytes({ text: "123456789" })).toString(16)).toBe("6c40df5f0b497347");
        const frames = [...mod.run({ text: "123456789" })];
        checkFrames(frames, 9);
        expect(frames[frames.length - 1]?.meta["checksum"]).toBe("6c40df5f0b497347");
    });

    it("agrees with an independent reference on many random byte strings", () => {
        let seed = 12345;
        for (let trial = 0; trial < 300; trial += 1) {
            const length = trial % 17;
            const bytes: number[] = [];
            for (let i = 0; i < length; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                bytes.push(seed & 0xff);
            }
            expect(crc64(bytes)).toBe(reference(bytes));
        }
    });

    it("absorbs bytes incrementally exactly as one-shot evaluation does", () => {
        const bytes = toBytes({ text: "incremental-check" });
        let register = 0n;
        for (const byte of bytes) {
            register = absorb(register, byte);
        }
        expect(register).toBe(crc64(bytes));
    });

    it("detects every single-bit flip in a short message", () => {
        const base = toBytes({ text: "burst detection" });
        const original = crc64(base);
        for (let i = 0; i < base.length; i += 1) {
            for (let bit = 0; bit < 8; bit += 1) {
                const corrupted = [...base];
                corrupted[i] = (corrupted[i] ?? 0) ^ (1 << bit);
                expect(crc64(corrupted)).not.toBe(original);
            }
        }
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
