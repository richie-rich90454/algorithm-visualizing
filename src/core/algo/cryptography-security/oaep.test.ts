/**
 * oaep.test.ts - Exhaustive padding roundtrip, tamper rejection, randomized blocks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { fnvHash, mgf1, oaepDecode, oaepEncode } from "./oaep";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            const b = entity.value as number;
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(255);
        }
    });
}

describe("OaepToy", () => {
    it("has a stable four-byte hash and a mask of the requested length", () => {
        expect(fnvHash([])).toHaveLength(4);
        expect(fnvHash([1, 2, 3])).toEqual(fnvHash([1, 2, 3]));
        expect(mgf1([9, 8, 7, 6], 0)).toEqual([]);
        expect(mgf1([9, 8, 7, 6], 37)).toHaveLength(37);
    });

    it("roundtrips 40 message and seed combinations and produces length-k blocks", () => {
        for (let m = 0; m < 8; m += 1) {
            for (const seedValue of [0, 1, 12345, 999999]) {
                const message = Array.from({ length: m }, (_, i) => (i * 37 + m) % 256);
                const k = 2 * 4 + 2 + m + 6;
                const seed = [0, 1, 2, 3].map((i) => (seedValue >>> (8 * i)) & 0xff);
                const encoded = oaepEncode(message, k, seed);
                expect(encoded.em).toHaveLength(k);
                expect(encoded.em[0]).toBe(0);
                const decoded = oaepDecode(encoded.em, k);
                expect(decoded.valid).toBe(true);
                expect(decoded.message).toEqual(message);
            }
        }
    });

    it("rejects every single-byte tamper of an encoded block", () => {
        const message = [72, 101, 108, 108, 111];
        const seed = [17, 34, 51, 68];
        const k = 20;
        const em = oaepEncode(message, k, seed).em;
        for (let i = 0; i < em.length; i += 1) {
            const bad = em.slice();
            bad[i] = (bad[i]! ^ 0xff) & 0xff;
            expect(oaepDecode(bad, k).valid).toBe(false);
        }
        expect(oaepDecode(em, k).valid).toBe(true);
    });

    it("randomizes the encoded block when the seed changes", () => {
        const message = [1, 2, 3];
        const a = oaepEncode(message, 18, [1, 2, 3, 4]).em;
        const b = oaepEncode(message, 18, [9, 8, 7, 6]).em;
        expect(a).not.toEqual(b);
        expect(oaepDecode(a, 18).message).toEqual(message);
        expect(oaepDecode(b, 18).message).toEqual(message);
    });

    it("reports a valid recovered message in the frame metadata", () => {
        const frames = [...mod.run({ message: "padding works", k: 30, seed: 777 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["valid"]).toBe(true);
        expect(last["recovered"]).toBe("padding works");
        expect((last["encoded"] as string)).toMatch(/^[0-9a-f]{60}$/);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
