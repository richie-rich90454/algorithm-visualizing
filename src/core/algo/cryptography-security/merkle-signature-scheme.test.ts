/**
 * merkle-signature-scheme.test.ts - One-time signature round trips, Merkle
 * root recomputation, tamper rejection, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { buildScheme, verifyScheme } from "./merkle-signature-scheme";
import type { VisualFrame } from "@/types";

/** Independent FNV-1a implementation used to rebuild the Merkle root. */
function fnv(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(7);
        expect(frame.edges.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((e) => e.sourceId.startsWith("node-") && e.targetId.startsWith("node-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Merkle Signature Scheme", () => {
    it("rebuilds the Merkle root from the leaf hashes by brute force", () => {
        const scheme = buildScheme("sign this", 77, 2);
        expect(scheme.leafHashes.length).toBe(4);
        let level = scheme.leafHashes;
        while (level.length > 1) {
            const next: string[] = [];
            for (let i = 0; i + 1 < level.length; i += 2) {
                next.push(fnv((level[i] ?? "") + "|" + (level[i + 1] ?? "")));
            }
            level = next;
        }
        expect(level[0]).toBe(scheme.root);
        expect(scheme.authPath.length).toBe(2);
        expect(scheme.authPath[0]).toBe(scheme.leafHashes[3]);
        expect(scheme.authPath[1]).toBe(scheme.levels[1]?.[0]);
    });

    it("verifies every leaf on distinct messages and rejects tampering", () => {
        for (let leaf = 0; leaf < 4; leaf += 1) {
            const message = `message for leaf ${leaf}`;
            const scheme = buildScheme(message, 42, leaf);
            expect(verifyScheme(message, scheme.root, scheme.sigDigits, scheme.authPath, leaf)).toBe(true);

            const frames = [...mod.run({ message, seed: 42, leafIndex: leaf })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["verified"]).toBe(true);
            expect(final?.["root"]).toBe(scheme.root);

            const badDigits = [...scheme.sigDigits];
            badDigits[0] = (badDigits[0] ?? 0) ^ 1;
            expect(verifyScheme(message, scheme.root, badDigits, scheme.authPath, leaf)).toBe(false);
            const badPath = [...scheme.authPath];
            badPath[0] = fnv("wrong sibling");
            expect(verifyScheme(message, scheme.root, scheme.sigDigits, badPath, leaf)).toBe(false);
            const tamperedFrames = [...mod.run({ message, seed: 42, leafIndex: leaf, authPath: badPath })];
            expect(tamperedFrames[tamperedFrames.length - 1]?.meta["verified"]).toBe(false);
        }
    });

    it("uses a different one-time key for each message digest", () => {
        const a = buildScheme("alpha", 9, 0);
        const b = buildScheme("beta", 9, 0);
        expect(a.digits).not.toEqual(b.digits);
        expect(a.sigDigits).not.toEqual(b.sigDigits);
        expect(verifyScheme("beta", a.root, a.sigDigits, a.authPath, 0)).toBe(false);
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
