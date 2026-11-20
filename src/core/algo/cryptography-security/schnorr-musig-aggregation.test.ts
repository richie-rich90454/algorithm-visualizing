/** schnorr-musig-aggregation.test.ts - Toy group checks and multisignature round trips. */

import { describe, expect, it } from "vitest";
import mod, {
    aggregatePublicKey,
    group,
    musigSign,
    musigVerify,
    powMod,
    scalarHash,
} from "./schnorr-musig-aggregation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Schnorr multisignature aggregation toy model", () => {
    it("builds a valid prime-order subgroup and deterministic scalars", () => {
        const { p, q, g } = group();
        expect(q).toBe(1009n);
        expect(p % q).toBe(1n);
        expect(g).not.toBe(1n);
        expect(powMod(g, q, p)).toBe(1n);
        expect(scalarHash([1, 2, 3])).toBe(scalarHash([1, 2, 3]));
        expect(aggregatePublicKey([powMod(g, 3n, p), powMod(g, 5n, p)])).toBe(
            aggregatePublicKey([powMod(g, 3n, p), powMod(g, 5n, p)]),
        );
    });

    it("verifies aggregate signatures and rejects tampering", () => {
        const { p, g } = group();
        const secrets = [11n, 23n, 37n];
        const pubkeys = secrets.map((secret) => powMod(g, secret, p));
        const aggregated = aggregatePublicKey(pubkeys);
        for (let i = 0; i < 5; i += 1) {
            const message = [i, i + 1, i + 2];
            const signature = musigSign(message, secrets);
            expect(musigVerify(message, signature, aggregated)).toBe(true);
            expect(musigVerify([...message, 99], signature, aggregated)).toBe(false);
            expect(musigVerify(message, { ...signature, s: signature.s + 1n }, aggregated)).toBe(false);
            expect(musigVerify(message, signature, (aggregated + 1n) % p)).toBe(false);
        }
    });

    it("emits well-formed frames and terminates with acceptance", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["verified"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
