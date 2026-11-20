/** aes-ccm.test.ts - Toy cipher collision, CTR reference, tag tamper detection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { ccmRoundTrip, computeTag, makeKeyStream, toyBlockEncrypt } from "./aes-ccm";
import type { VisualFrame } from "@/types";

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

describe("AES-CCM toy core", () => {
    it("the toy block map has no collisions on a large sample", () => {
        const key = [7, 31, 15, 23];
        const seen = new Set<string>();
        for (let i = 0; i < 400; i += 1) {
            const block = [i & 255, (i >>> 8) & 255, (i * 7 + 3) & 255, (i * 13 + 11) & 255];
            const out = toyBlockEncrypt(block, key);
            expect(out.length).toBe(4);
            expect(out.every((b) => b >= 0 && b < 256)).toBe(true);
            seen.add(out.join(","));
        }
        expect(seen.size).toBe(400);
    });

    it("matches an independent counter keystream reference", () => {
        const key = [1, 2, 3, 4];
        const nonce = [9, 8, 7, 0];
        const expected: number[] = [];
        for (let counter = 0; counter < 5 && expected.length < 13; counter += 1) {
            expected.push(...toyBlockEncrypt([9, 8, 7, counter & 255], key));
        }
        const got = makeKeyStream(key, nonce, 13);
        expect(got).toEqual(expected.slice(0, 13));
        expect(got.length).toBe(13);
    });

    it("round-trips and detects tampering of data or associated data", () => {
        const key = [7, 31, 15, 23];
        const nonce = [1, 2, 3, 4];
        const message = [10, 20, 30, 40, 50, 60];
        const associated = [1, 2, 3];
        const good = ccmRoundTrip(key, nonce, message, associated);
        expect(good.verified).toBe(true);
        expect(good.plaintext).toEqual(message);
        expect(good.ciphertext).not.toEqual(message);
        const badAssociated = computeTag(key, nonce, [1, 2, 4], message);
        expect(badAssociated).not.toEqual(good.tag);
        const badMessage = computeTag(key, nonce, associated, [10, 20, 31, 40, 50, 60]);
        expect(badMessage).not.toEqual(good.tag);
    });

    it("emits well-formed frames, including a tamper verdict", () => {
        const generator = mod.run({ ...(mod.defaultInput as object), tamper: true });
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["done"]).toBe(true);
        expect(final["verified"]).toBe(0);
        expect(generator.next().done).toBe(true);
    });
});
