/** order-preserving-encryption.test.ts - Brute-force order and round-trip checks. */

import { describe, expect, it } from "vitest";
import mod, { buildOpe, jitter, opeDecrypt, opeEncrypt, preservesOrder } from "./order-preserving-encryption";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Order-preserving encryption toy model", () => {
    it("keeps jitter strictly below the grid gap", () => {
        for (let key = 0; key < 40; key += 1) {
            for (let rank = 0; rank < 100; rank += 1) {
                expect(jitter(rank, key) < 1000n).toBe(true);
            }
        }
    });

    it("preserves order for every pair and round-trips every value", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const domain = Array.from({ length: 12 }, () => Math.floor(Math.random() * 1000));
            const key = Math.floor(Math.random() * 100);
            const state = buildOpe(domain, key);
            expect(state.domain.length).toBe(new Set(domain).size);
            expect(preservesOrder(state)).toBe(true);
            for (const value of state.domain) {
                const cipher = opeEncrypt(state, value);
                expect(cipher).not.toBeNull();
                expect(opeDecrypt(state, cipher as bigint)).toBe(value);
            }
            for (let i = 1; i < state.domain.length; i += 1) {
                expect(state.ciphers[i] as bigint).toBeGreaterThan(state.ciphers[i - 1] as bigint);
            }
        }
        expect(opeEncrypt(buildOpe([1, 2, 3], 5), 999)).toBeNull();
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["orderPreserved"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
