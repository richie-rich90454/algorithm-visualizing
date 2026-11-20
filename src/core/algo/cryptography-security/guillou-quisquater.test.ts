/** guillou-quisquater.test.ts - Protocol equation check, impostor rejection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { gqKeyPair, gqProve, gqVerify, powMod } from "./guillou-quisquater";
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

describe("Guillou-Quisquater identification (toy model)", () => {
    it("accepts every honest transcript over a brute-forced grid", () => {
        for (let secret = 1; secret <= 20; secret += 1) {
            if ([7, 11, 14].includes(secret)) continue;
            const keys = gqKeyPair(secret);
            expect(keys.publicKey).toBe(powMod(keys.secret, 7, 77));
            for (let nonce = 1; nonce <= 6; nonce += 1) {
                for (let challenge = 0; challenge < 7; challenge += 1) {
                    const transcript = gqProve(secret, nonce, challenge);
                    expect(gqVerify(transcript, keys.publicKey)).toBe(true);
                }
            }
        }
    });

    it("rejects wrong secrets, wrong keys, and wrong challenges", () => {
        const keys = gqKeyPair(4);
        const honest = gqProve(4, 5, 3);
        const impostor = gqProve(5, 5, 3);
        expect(gqVerify(impostor, keys.publicKey)).toBe(false);
        expect(gqVerify(honest, keys.publicKey + 1 === 77 ? 1 : keys.publicKey + 1)).toBe(false);
        expect(gqVerify({ ...honest, challenge: 4 }, keys.publicKey)).toBe(false);
        expect(gqVerify({ ...honest, response: (honest.response + 1) % 77 }, keys.publicKey)).toBe(false);
    });

    it("emits well-formed frames, including an impostor verdict", () => {
        const generator = mod.run({ ...(mod.defaultInput as object), wrongSecret: true });
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["verified"]).toBe(0);
        expect(generator.next().done).toBe(true);
    });
});
