/**
 * lms-signature.test.ts - Independent hash-chain and Merkle verification,
 * tamper detection for message and authentication path, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lms-signature";
import type { VisualFrame } from "@/types";

const P = 1000003;
const BASE = 16;
const LEN = 4;
const MAX_CHAIN = BASE - 1;

function h(x: number): number {
    return (x * 48271 + 11) % P;
}

function chain(seed: number, n: number): number {
    let value = ((seed % P) + P) % P;
    for (let i = 0; i < n; i += 1) value = h(value);
    return value;
}

function h2(l: number, r: number): number {
    return (l * 31 + r * 17 + 1) % P;
}

function reference(digits: number[], seed: number) {
    const secret = Array.from({ length: LEN }, (_v, i) => (seed + i * 123457) % P);
    const publicKeys = secret.map((s) => chain(s, MAX_CHAIN));
    const signature = digits.map((d, i) => chain(secret[i] ?? 0, d));
    const root = h2(h2(publicKeys[0] ?? 0, publicKeys[1] ?? 0), h2(publicKeys[2] ?? 0, publicKeys[3] ?? 0));
    const authPath = [publicKeys[1] ?? 0, h2(publicKeys[2] ?? 0, publicKeys[3] ?? 0)];
    return { publicKeys, signature, root, authPath };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(7);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(6);
        expect(frame.edges.every((edge) => frame.entities.some((e) => e.id === edge.sourceId) && frame.entities.some((e) => e.id === edge.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["p"]).toBe(P);
        expect(frame.meta["base"]).toBe(BASE);
        expect(frame.meta["len"]).toBe(LEN);
    });
}

describe("ToyLMS", () => {
    it("reproduces the reference one-time keys, signature, and Merkle root", () => {
        const input = mod.defaultInput as { messageDigits: number[]; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.messageDigits, input.seed);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["publicKeys"]).toEqual(expected.publicKeys);
        expect(final?.["signature"]).toEqual(expected.signature);
        expect(final?.["authPath"]).toEqual(expected.authPath);
        expect(final?.["root"]).toBe(expected.root);
        expect(final?.["accept"]).toBe(true);
        expect(final?.["wotsValid"]).toBe(true);
        expect(final?.["merkleValid"]).toBe(true);
        for (let i = 0; i < LEN; i += 1) {
            expect(chain(expected.signature[i] ?? 0, MAX_CHAIN - (input.messageDigits[i] ?? 0))).toBe(expected.publicKeys[i]);
        }
    });

    it("rejects a message whose one-time chain fails", () => {
        const input = mod.defaultInput as { messageDigits: number[]; seed: number };
        const bad = input.messageDigits.slice();
        bad[2] = (bad[2]! + 1) % BASE;
        const final = [...mod.run({ ...input, verifyDigits: bad })].pop()?.meta;
        expect(final?.["accept"]).toBe(false);
        expect(final?.["wotsValid"]).toBe(false);
        expect(final?.["merkleValid"]).toBe(true);
    });

    it("rejects a corrupted authentication path", () => {
        const final = [...mod.run({ ...(mod.defaultInput as { messageDigits: number[]; seed: number }), tamperAuth: true })].pop()?.meta;
        expect(final?.["accept"]).toBe(false);
        expect(final?.["merkleValid"]).toBe(false);
        expect(final?.["wotsValid"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
