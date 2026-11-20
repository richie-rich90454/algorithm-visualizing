/** idea-cipher.test.ts - Independent replay, round-trip, modular inverse, termination. */

import { describe, expect, it } from "vitest";
import mod from "./idea-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    mode: "encrypt" | "decrypt";
}

function outputOf(input: Input): number[] {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta["output"] as number[];
}

function reference(input: Input): number[] {
    const mul = (a: number, b: number): number => {
        const x = a === 0 ? 65536 : a;
        const y = b === 0 ? 65536 : b;
        const p = (x * y) % 65537;
        return p === 65536 ? 0 : p;
    };
    const inv = (a: number): number => {
        const x = a === 0 ? 65536 : a;
        let oldR = 65537;
        let r = x;
        let oldS = 0;
        let s = 1;
        while (r !== 0) {
            const q = Math.floor(oldR / r);
            const nr = oldR - q * r;
            oldR = r;
            r = nr;
            const ns = oldS - q * s;
            oldS = s;
            s = ns;
        }
        const v = ((oldS % 65537) + 65537) % 65537;
        return v === 65536 ? 0 : v;
    };
    const kw: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        kw.push((((input.key[i * 2] ?? 0) << 8) | (input.key[i * 2 + 1] ?? 0)) & 65535);
    }
    const k = Array.from({ length: 52 }, (_, i) => (kw[i % 8] + Math.imul(i, 0x2d1)) & 65535);
    const w: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        w.push((((input.block[i * 2] ?? 0) << 8) | (input.block[i * 2 + 1] ?? 0)) & 65535);
    }
    if (input.mode === "encrypt") {
        for (let r = 0; r < 8; r += 1) {
            const [k1, k2, k3, k4, k5, k6] = k.slice(6 * r, 6 * r + 6);
            w[0] = mul(w[0], k1);
            w[1] = (w[1] + k2) & 65535;
            w[2] = (w[2] + k3) & 65535;
            w[3] = mul(w[3], k4);
            let t = mul(k5, w[0] ^ w[2]);
            w[1] ^= t;
            w[3] ^= t;
            t = mul(k6, w[1] ^ w[3]);
            w[0] ^= t;
            w[2] ^= t;
            if (r < 7) {
                const tmp = w[1];
                w[1] = w[2];
                w[2] = tmp;
            }
        }
        w[0] = mul(w[0], k[48]);
        w[2] = (w[2] + k[49]) & 65535;
        w[1] = (w[1] + k[50]) & 65535;
        w[3] = mul(w[3], k[51]);
    } else {
        w[0] = mul(w[0], inv(k[48]));
        w[3] = mul(w[3], inv(k[51]));
        w[2] = (w[2] - k[49]) & 65535;
        w[1] = (w[1] - k[50]) & 65535;
        for (let r = 7; r >= 0; r -= 1) {
            if (r < 7) {
                const tmp = w[1];
                w[1] = w[2];
                w[2] = tmp;
            }
            const [k1, k2, k3, k4, k5, k6] = k.slice(6 * r, 6 * r + 6);
            let t = mul(k6, w[1] ^ w[3]);
            w[0] ^= t;
            w[2] ^= t;
            t = mul(k5, w[0] ^ w[2]);
            w[1] ^= t;
            w[3] ^= t;
            w[3] = mul(w[3], inv(k4));
            w[2] = (w[2] - k3) & 65535;
            w[1] = (w[1] - k2) & 65535;
            w[0] = mul(w[0], inv(k1));
        }
    }
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        out.push(w[i] >>> 8);
        out.push(w[i] & 255);
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("IDEA Teaching Core", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: Array.from({ length: 16 }, (_, i) => i),
        mode: "encrypt",
    };

    it("matches an independent IDEA replay", () => {
        checkFrames([...mod.run(base)]);
        expect(outputOf(base)).toEqual(reference(base));
    });

    it("recovers the plaintext on decryption", () => {
        const ciphertext = outputOf(base);
        expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(base.block);
    });

    it("multiplication mod 65537 cancels with its inverse", () => {
        const mul = (a: number, b: number): number => {
            const x = a === 0 ? 65536 : a;
            const y = b === 0 ? 65536 : b;
            const p = (x * y) % 65537;
            return p === 65536 ? 0 : p;
        };
        for (const a of [0, 1, 2, 12345, 65535]) {
            // The inverse of a is the value b with mul(a, b) = 1.
            let found = -1;
            for (let b = 0; b <= 65535 && found < 0; b += 1) {
                if (mul(a, b) === 1) found = b;
            }
            expect(found).toBeGreaterThanOrEqual(0);
            expect(mul(a, found)).toBe(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
