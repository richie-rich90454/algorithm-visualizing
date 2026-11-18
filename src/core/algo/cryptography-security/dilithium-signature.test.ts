/** dilithium-signature.test.ts - Brute-force and frame checks for the toy model. */

import { describe, expect, it } from "vitest";
import mod from "./dilithium-signature";
import type { VisualFrame } from "@/types";

function modValue(value: number, q: number): number {
    return ((value % q) + q) % q;
}

function challenge(commitment: number, message: string): number {
    let sum = 0;
    for (let i = 0; i < message.length; i += 1) {
        sum += message.charCodeAt(i);
    }
    return ((commitment + sum + message.length) % 3) + 1;
}

/** Independent toy signing and verification reference. */
function reference(q: number, a: number, s: number, y: number, message: string) {
    const t = modValue(a * s, q);
    const w = modValue(a * y, q);
    const c = challenge(w, message);
    const z = modValue(y + c * s, q);
    const left = modValue(a * z, q);
    const right = modValue(w + c * t, q);
    return { t, w, c, z, left, right, verified: left === right && z <= Math.floor(q / 3) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dilithium toy signature", () => {
    it("satisfies the verification identity over many random-looking inputs", () => {
        const q = 97;
        let seed = 987654;
        const next = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        const messages = ["hi", "hello", "a", "message", ""];
        for (let trial = 0; trial < 200; trial += 1) {
            const a = next() % q;
            const s = next() % q;
            const y = next() % q;
            const message = messages[trial % messages.length]!;
            const result = reference(q, a, s, y, message);
            expect(result.left).toBe(result.right);
        }
    });

    it("matches the module output on the default and alternate inputs", () => {
        const cases = [
            { q: 97, a: 13, s: 7, y: 3, message: "hi" },
            { q: 101, a: 20, s: 4, y: 2, message: "test" },
            { q: 89, a: 5, s: 9, y: 1, message: "abc" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input.q, input.a, input.s, input.y, input.message);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["t"]).toBe(expected.t);
            expect(finalMeta?.["w"]).toBe(expected.w);
            expect(finalMeta?.["c"]).toBe(expected.c);
            expect(finalMeta?.["z"]).toBe(expected.z);
            expect(finalMeta?.["lhs"]).toBe(expected.left);
            expect(finalMeta?.["rhs"]).toBe(expected.right);
            expect(finalMeta?.["verified"]).toBe(expected.verified);
        }
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
