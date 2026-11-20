/**
 * bfv-homomorphic-encryption.test.ts - Toy homomorphism, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bfv-homomorphic-encryption";
import type { VisualFrame } from "@/types";

const modv = (value: number, m: number): number => ((value % m) + m) % m;

/** Independent toy encrypt/decrypt to confirm homomorphic results. */
function reference(x: number, y: number, c: number, q: number, delta: number, a: number, s: number) {
    const b = modv(a * s + 1, q);
    const rand = (m: number, nonce: number): [number, number, number] => [
        modv(m * 7 + nonce * 13 + 5, 7) - 3,
        modv(m * 3 + nonce * 11 + 2, 5) - 2,
        modv(m * 5 + nonce * 3 + 4, 5) - 2,
    ];
    const enc = (m: number, nonce: number): [number, number] => {
        const [r, e1, e2] = rand(m, nonce);
        return [modv(a * r + e1, q), modv(b * r + e2 + m * delta, q)];
    };
    const dec = (ct: [number, number]): number => {
        let v = modv(ct[1] - s * ct[0], q);
        if (v > q / 2) {
            v -= q;
        }
        return Math.round(v / delta);
    };
    const cx = enc(x, 0);
    const cy = enc(y, 1);
    return [
        dec(cx),
        dec(cy),
        dec([modv(cx[0] + cy[0], q), modv(cx[1] + cy[1], q)]),
        dec([modv(cx[0] * c, q), modv(cx[1] * c, q)]),
    ];
}

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BFV toy homomorphism", () => {
    it("decrypts fresh, added, and scaled ciphertexts correctly", () => {
        const input = mod.defaultInput as {
            q: number; delta: number; a: number; s: number; x: number; y: number; c: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const results = frames[frames.length - 1]?.meta["results"] as number[];
        expect(results).toEqual(reference(input.x, input.y, input.c, input.q, input.delta, input.a, input.s));
        expect(results).toEqual([input.x, input.y, input.x + input.y, input.x * input.c]);
    });

    it("keeps the homomorphism on other small operands", () => {
        const input = { x: 12, y: 5, c: 3 };
        const frames = [...mod.run(input)];
        const results = frames[frames.length - 1]?.meta["results"] as number[];
        expect(results).toEqual([12, 5, 17, 36]);
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
