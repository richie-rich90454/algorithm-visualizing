/** ring-signature.test.ts - Exhaustive small-ring verification, tamper rejection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { powMod, ringSign, ringVerify } from "./ring-signature";
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

describe("Ring Signature (toy model)", () => {
    it("uses the expected small-group powers", () => {
        expect(powMod(2, 1, 23)).toBe(2);
        expect(powMod(2, 11, 23)).toBe(1);
        expect(powMod(2, 3, 23)).toBe(8);
    });

    it("accepts a signature from every member of a ring", () => {
        for (let size = 2; size <= 5; size += 1) {
            const secrets = Array.from({ length: size }, (_, i) => 1 + ((i * 3 + 2) % 10));
            const keys = secrets.map((s) => powMod(2, s, 23));
            for (let signer = 0; signer < size; signer += 1) {
                const signature = ringSign(keys, signer, secrets[signer]!, 5, 13 + size + signer);
                expect(signature).not.toBeNull();
                expect(ringVerify(keys, signature!)).toBe(true);
            }
        }
    });

    it("rejects a changed message or a changed public key", () => {
        const secrets = [3, 5, 7, 9];
        const keys = secrets.map((s) => powMod(2, s, 23));
        const signature = ringSign(keys, 2, secrets[2]!, 6, 31)!;
        expect(ringVerify(keys, signature)).toBe(true);
        expect(ringVerify(keys, { ...signature, message: signature.message + 1 })).toBe(false);
        const altered = keys.slice();
        altered[0] = powMod(2, 1, 23);
        expect(ringVerify(altered, signature)).toBe(false);
        expect(ringVerify(keys.slice(0, 3), signature)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["verified"]).toBe(1);
        expect(generator.next().done).toBe(true);
    });
});
