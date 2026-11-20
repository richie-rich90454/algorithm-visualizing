/** hash-chain.test.ts - Independent FNV reference, link verification, tamper detection, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { buildHashChain, toyHash, verifyHashChain } from "./hash-chain";
import type { VisualFrame } from "@/types";

/** Independent FNV-1a implementation used as a reference. */
function refHash(value: number | string): number {
    const text = String(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hash Chain (toy hash)", () => {
    it("matches an independent FNV-1a reference", () => {
        for (let value = 0; value < 300; value += 1) {
            expect(toyHash(value)).toBe(refHash(value));
        }
        for (const text of ["", "a", "hello", "chain link 42", "12345"]) {
            expect(toyHash(text)).toBe(refHash(text));
        }
    });

    it("builds links that each equal the hash of the previous link", () => {
        for (const seed of [0, 1, 12345, 4294967295]) {
            for (const length of [1, 2, 5, 12]) {
                const chain = buildHashChain(seed, length);
                expect(chain.length).toBe(length + 1);
                expect(chain[0]).toBe(seed >>> 0);
                for (let i = 1; i < chain.length; i += 1) {
                    expect(chain[i]).toBe(refHash(chain[i - 1] ?? 0));
                }
                const head = chain[chain.length - 1] ?? 0;
                expect(verifyHashChain(chain, seed, head)).toBe(true);
            }
        }
    });

    it("rejects tampered links and wrong seeds or heads", () => {
        const seed = 12345;
        const chain = buildHashChain(seed, 6);
        const head = chain[chain.length - 1] ?? 0;
        for (let i = 1; i < chain.length; i += 1) {
            const broken = [...chain];
            broken[i] = (broken[i] ?? 0) ^ 1;
            expect(verifyHashChain(broken, seed, head)).toBe(false);
        }
        expect(verifyHashChain(chain, seed + 1, head)).toBe(false);
        expect(verifyHashChain(chain, seed, head ^ 1)).toBe(false);
        expect(verifyHashChain([], seed, head)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["verified"]).toBe(true);
        expect(final?.["tamperRejected"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
