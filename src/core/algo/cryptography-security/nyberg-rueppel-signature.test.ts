/** nyberg-rueppel-signature.test.ts - Exhaustive sign/recover check, tamper rejection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { powMod, recover, sign } from "./nyberg-rueppel-signature";
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

describe("Nyberg-Rueppel signature (toy model)", () => {
    it("recovers every message for every secret and nonce", () => {
        for (let secret = 1; secret < 11; secret += 1) {
            const publicKey = powMod(2, secret, 23);
            for (let message = 1; message < 23; message += 1) {
                for (let nonce = 1; nonce < 11; nonce += 1) {
                    const signature = sign(message, secret, nonce);
                    expect(recover(signature, publicKey)).toBe(message);
                }
            }
        }
    });

    it("rejects tampered signatures and out-of-range values", () => {
        const publicKey = powMod(2, 6, 23);
        const signature = sign(9, 6, 3);
        expect(recover({ r: signature.r, s: (signature.s + 1) % 11 }, publicKey)).not.toBe(9);
        expect(recover({ r: signature.r + 1, s: signature.s }, publicKey)).not.toBe(9);
        expect(recover({ r: 0, s: 0 }, publicKey)).toBeNull();
        expect(recover({ r: 23, s: 1 }, publicKey)).toBeNull();
    });

    it("emits well-formed frames, including a tamper verdict", () => {
        const generator = mod.run({ ...(mod.defaultInput as object), tamper: true });
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["verified"]).toBe(0);
        expect(generator.next().done).toBe(true);
    });
});
