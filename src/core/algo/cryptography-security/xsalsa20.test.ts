/**
 * xsalsa20.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./xsalsa20";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function last(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta as unknown as Record<string, unknown>;
}

describe("XSalsa20 toy stream cipher", () => {
    it("round-trips arbitrary plaintext under many keys and nonces", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const key = Array.from({ length: 16 }, (_, i) => (seed * 17 + i * 11) & 0xff);
            const nonce = Array.from({ length: 24 }, (_, i) => (seed * 3 + i * 5) & 0xff);
            const plaintext = Array.from({ length: 1 + (seed % 20) }, (_, i) => (seed * 29 + i * 7) & 0xff);
            const meta = last({ key, nonce, plaintext, doubleRounds: 3 });
            expect(meta["recovered"]).toEqual(plaintext);
            expect(meta["ciphertext"]).not.toEqual(plaintext);
        }
    });

    it("is deterministic and sensitive to key and nonce", () => {
        const base = { key: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], nonce: Array.from({ length: 24 }, (_, i) => i + 1), plaintext: [1, 2, 3, 4, 5], doubleRounds: 4 };
        const a = last(base)["ciphertext"];
        const b = last(base)["ciphertext"];
        const c = last({ ...base, nonce: base.nonce.map((n, i) => (i === 23 ? n + 1 : n)) })["ciphertext"];
        const d = last({ ...base, key: base.key.map((k, i) => (i === 0 ? k + 1 : k)) })["ciphertext"];
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
        expect(a).not.toEqual(d);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
