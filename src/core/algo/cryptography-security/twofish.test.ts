/** twofish.test.ts - Independent round replay, round-trip, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./twofish";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

function outputOf(input: Input): number[] {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta["output"] as number[];
}

/** Independent replay of the same teaching-core Feistel steps. */
function reference(input: Input): number[] {
    const mds = [
        [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2], [2, 3, 1, 1],
    ];
    const gmul = (a0: number, b0: number): number => {
        let p = 0;
        let x = a0 & 255;
        let y = b0 & 255;
        for (let i = 0; i < 8; i += 1) {
            if (y & 1) p ^= x;
            const hi = x & 128;
            x = (x << 1) & 255;
            if (hi) x ^= 0x1b;
            y >>= 1;
        }
        return p;
    };
    const sb = (v: number): number => ((((v & 255) << 1) | ((v & 255) >>> 7)) ^ 0x63) & 255;
    const F = (w: number, k: number): number => {
        const t = (w ^ k) >>> 0;
        const s = [t & 255, (t >>> 8) & 255, (t >>> 16) & 255, (t >>> 24) & 255].map(sb);
        let out = 0;
        for (let i = 0; i < 4; i += 1) {
            let b = 0;
            for (let j = 0; j < 4; j += 1) b ^= gmul(mds[i]?.[j] ?? 0, s[j] ?? 0);
            out |= b << (8 * i);
        }
        return out >>> 0;
    };
    const keys = Array.from({ length: input.rounds }, (_, i) =>
        (((input.key[i % input.key.length] ?? 0) + Math.imul(i, 0x9e3779b9)) >>> 0),
    );
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (input.block[i] ?? 0) << (8 * i);
        right |= (input.block[4 + i] ?? 0) << (8 * i);
    }
    left >>>= 0;
    right >>>= 0;
    if (input.mode === "encrypt") {
        for (let i = 0; i < input.rounds; i += 1) {
            const nl = right;
            const nr = (left ^ F(right, keys[i])) >>> 0;
            left = nl;
            right = nr;
        }
    } else {
        for (let i = input.rounds - 1; i >= 0; i -= 1) {
            const pr = left;
            const pl = (right ^ F(left, keys[i])) >>> 0;
            left = pl;
            right = pr;
        }
    }
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) out.push((left >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i += 1) out.push((right >>> (8 * i)) & 255);
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

describe("Twofish Teaching Core", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 16,
        mode: "encrypt",
    };

    it("matches an independent Feistel replay", () => {
        const frames = [...mod.run(base)];
        checkFrames(frames);
        expect(outputOf(base)).toEqual(reference(base));
    });

    it("recovers the plaintext on decryption", () => {
        const ciphertext = outputOf(base);
        const recovered = outputOf({ ...base, block: ciphertext, mode: "decrypt" });
        expect(recovered).toEqual(base.block);
    });

    it("changes the ciphertext when the key changes", () => {
        const changed = outputOf({ ...base, key: [2, 2, 3, 4, 5, 6, 7, 8] });
        expect(changed).not.toEqual(outputOf(base));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
