/**
 * ntru-encryption.test.ts - Inverse identity check, exhaustive message-space
 * decryption, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ntru-encryption";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function modulus(a: number, m: number): number {
    return ((a % m) + m) % m;
}

/** Independent schoolbook cyclic convolution. */
function mul(a: number[], b: number[], m: number): number[] {
    const n = a.length;
    const out = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            out[(i + j) % n] = modulus(out[(i + j) % n] + modulus(a[i], m) * modulus(b[j], m), m);
        }
    }
    return out;
}

function center(values: number[], m: number): number[] {
    const half = Math.floor(m / 2);
    return values.map((v) => (v > half ? v - m : v));
}

describe("NTRUEncryption", () => {
    it("the reported inverses satisfy the ring identity", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 7);
        const keyFrame = frames[1]?.meta;
        const f = (mod.defaultInput as { f: number[] }).f;
        const p = Number(keyFrame?.["p"]);
        const q = Number(keyFrame?.["q"]);
        const Fp = keyFrame?.["Fp"] as number[];
        const Fq = keyFrame?.["Fq"] as number[];
        const identityP = Array(7).fill(0);
        const identityQ = Array(7).fill(0);
        identityP[0] = 1;
        identityQ[0] = 1;
        expect(mul(f, Fp, p)).toEqual(identityP);
        expect(mul(f, Fq, q)).toEqual(identityQ);
    });

    it("matches an independent encrypt/decrypt replay", () => {
        const input = mod.defaultInput as {
            p: number;
            q: number;
            f: number[];
            g: number[];
            r: number[];
            m: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 7);
        const final = frames[frames.length - 1]?.meta;
        const h = final?.["h"] as number[];
        const expectedE = mul(input.r, h, input.q).map((v, i) => modulus(v + modulus(input.m[i], input.q), input.q));
        expect(final?.["e"]).toEqual(expectedE);
        const expectedA = center(mul(input.f, expectedE, input.q), input.q);
        expect(final?.["a"]).toEqual(expectedA);
        const Fp = frames[1]?.meta["Fp"] as number[];
        const expectedRecovered = mul(Fp, expectedA.map((v) => modulus(v, input.p)), input.p);
        expect(final?.["recovered"]).toEqual(expectedRecovered);
        expect(final?.["match"]).toBe(true);
    });

    it("recovers every binary message for several randomizers", () => {
        const input = mod.defaultInput as { p: number; q: number; f: number[]; g: number[] };
        const randomizers = [
            [0, 1, 0, -1, 0, 1, 0],
            [1, 0, -1, 0, 0, 0, 1],
            [-1, 1, 0, 0, 1, 0, 0],
        ];
        for (let bits = 0; bits < 128; bits += 1) {
            const m = Array.from({ length: 7 }, (_v, i) => (bits >> i) & 1);
            for (const r of randomizers) {
                const frames = [...mod.run({ ...input, r, m })];
                checkFrames(frames, 7);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["match"]).toBe(true);
                expect(final?.["recovered"]).toEqual(m);
            }
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
