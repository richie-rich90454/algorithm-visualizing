/** saber-kem.test.ts - Exhaustive shared-bit agreement, rounding property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { decapsulate, encapsulate, publicPoly, reconcile, round16to4, roundCipher, roundPublic, secretPoly } from "./saber-kem";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Saber-Style LWR KEM (toy)", () => {
    it("rounding maps every residue into the small modulus", () => {
        for (let value = -40; value <= 40; value += 1) {
            const rounded = round16to4(value);
            expect(rounded).toBeGreaterThanOrEqual(0);
            expect(rounded).toBeLessThan(4);
            expect(rounded).toBe(Math.floor(((((value % 16) + 16) % 16) + 2) / 4) % 4);
        }
    });

    it("shares the same bit for all binary secrets and messages", () => {
        for (let seed = 0; seed < 32; seed += 1) {
            const a = publicPoly(seed);
            const s = secretPoly(seed);
            expect(s.every((v) => v === 0 || v === 1)).toBe(true);
            const b = roundPublic(a, s);
            expect(b.every((v) => v >= 0 && v < 4)).toBe(true);
            for (let messageSeed = 0; messageSeed < 32; messageSeed += 1) {
                const r = secretPoly(messageSeed);
                const { ciphertext, bit } = encapsulate(a, b, r);
                expect(ciphertext).toEqual(roundCipher(a, r));
                expect(decapsulate(ciphertext, s)).toBe(bit);
                expect(reconcile(b, r)).toBe(bit);
            }
        }
    });

    it("changing the message changes the ciphertext", () => {
        const a = publicPoly(7);
        const base = roundCipher(a, secretPoly(3));
        const matches = Array.from({ length: 32 }, (_, seed) => roundCipher(a, secretPoly(seed)));
        expect(matches.some((value) => value.join(",") !== base.join(","))).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["agreed"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
