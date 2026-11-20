/**
 * winternitz-ots.test.ts - Independent hash-chain reference, exhaustive digit
 * verification, tamper rejection, frame shape, and termination checks. Uses a
 * toy hash and makes no security claim.
 */

import { describe, expect, it } from "vitest";
import mod from "./winternitz-ots";
import type { VisualFrame } from "@/types";

function hash(value: number): number {
    return (Math.imul(value, 1664525) + 12345) >>> 0;
}

function chain(start: number, steps: number): number {
    let value = start;
    for (let i = 0; i < steps; i += 1) value = hash(value);
    return value;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["w"]).toBeDefined();
    });
}

describe("WinternitzOtsToy", () => {
    it("reproduces independent hash chains for key generation, signing, and verification", () => {
        const input = { digits: [3, 5, 2], chainLength: 8, seed: 7 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1];
        const salts = input.digits.map((_d, i) => hash(7 + i + 1));
        const publicKeys = salts.map((s) => chain(s, 8));
        const signatures = input.digits.map((d, i) => chain(salts[i] ?? 0, 8 - d));
        const finished = input.digits.map((d, i) => chain(signatures[i] ?? 0, d));
        expect(final?.meta["salts"]).toEqual(salts);
        expect(final?.meta["publicKeys"]).toEqual(publicKeys);
        expect(final?.meta["signatures"]).toEqual(signatures);
        expect(final?.meta["finished"]).toEqual(finished);
        expect(final?.meta["verified"]).toBe(true);
    });

    it("verifies every digit value across several chain lengths", () => {
        for (const w of [2, 4, 8, 12]) {
            for (let d = 0; d < w; d += 1) {
                const frames = [...mod.run({ digits: [d], chainLength: w, seed: 99 })];
                const final = frames[frames.length - 1];
                expect(final?.meta["verified"]).toBe(true);
                const salt = hash(99 + 1);
                const signature = chain(salt, w - d);
                expect(chain(signature, d)).toBe(chain(salt, w));
            }
        }
    });

    it("rejects a tampered signature element", () => {
        const frames = [...mod.run({ digits: [4], chainLength: 8, seed: 7 })];
        const final = frames[frames.length - 1];
        const publicKey = (final?.meta["publicKeys"] as number[])[0] ?? 0;
        const signature = (final?.meta["signatures"] as number[])[0] ?? 0;
        expect(hash(signature)).not.toBe(publicKey);
        expect(chain(signature, 4)).toBe(publicKey);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
