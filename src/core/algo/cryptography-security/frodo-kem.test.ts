/**
 * frodo-kem.test.ts - Public-key and ciphertext equation checks, shared-bit
 * agreement across seeds, noise bound, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { buildFrodo } from "./frodo-kem";
import type { VisualFrame } from "@/types";

const modq = (value: number, q: number): number => ((value % q) + q) % q;
const centered = (value: number, q: number): number => {
    const r = modq(value, q);
    return r > q / 2 ? r - q : r;
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(32);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(16);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Frodo-Style LWE KEM", () => {
    it("satisfies every public-key and ciphertext equation exactly", () => {
        const input = mod.defaultInput as { q: number; n: number; k: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const get = (name: string): number[] => final?.[name] as number[];
        const q = input.q;
        const n = input.n;
        const k = input.k;
        const A = get("A");
        const S = get("S");
        const E = get("E");
        const B = get("B");
        const R = get("R");
        const E1 = get("E1");
        const E2 = get("E2");
        const bits = get("bits");
        const U = get("U");
        const V = get("V");
        const W = get("W");

        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < k; j += 1) {
                let dot = E[i * k + j] ?? 0;
                for (let t = 0; t < n; t += 1) {
                    dot += (A[i * n + t] ?? 0) * (S[t * k + j] ?? 0);
                }
                expect(B[i * k + j]).toBe(modq(dot, q));
            }
        }
        for (let i = 0; i < k; i += 1) {
            for (let j = 0; j < n; j += 1) {
                let dot = E1[i * n + j] ?? 0;
                for (let t = 0; t < n; t += 1) {
                    dot += (R[i * n + t] ?? 0) * (A[t * n + j] ?? 0);
                }
                expect(U[i * n + j]).toBe(modq(dot, q));
            }
            for (let j = 0; j < k; j += 1) {
                let dot = (E2[i * k + j] ?? 0) + (bits[i * k + j] ?? 0) * Math.floor(q / 2);
                for (let t = 0; t < n; t += 1) {
                    dot += (R[i * n + t] ?? 0) * (B[t * k + j] ?? 0);
                }
                expect(V[i * k + j]).toBe(modq(dot, q));
            }
        }

        for (let i = 0; i < k; i += 1) {
            for (let j = 0; j < k; j += 1) {
                let us = 0;
                for (let t = 0; t < n; t += 1) {
                    us += (U[i * n + t] ?? 0) * (S[t * k + j] ?? 0);
                }
                expect(W[i * k + j]).toBe(centered((V[i * k + j] ?? 0) - us, q));
                const noise = (final?.["noise"] as number[])[i * k + j] ?? 0;
                expect(noise).toBe(centered((V[i * k + j] ?? 0) - (bits[i * k + j] ?? 0) * Math.floor(q / 2) - us, q));
                expect(Math.abs(noise)).toBeLessThan(q / 4);
            }
        }
        expect(final?.["agreed"]).toBe(true);
        expect(final?.["recovered"]).toEqual(bits);
    });

    it("agrees on the shared bits across seeds, sizes, and moduli", () => {
        for (const q of [97, 101, 127]) {
            for (const seed of [1, 7, 20261118, 999983]) {
                const data = buildFrodo(q, 4, 2, seed);
                expect(data.agreed).toBe(true);
                expect(data.recovered).toEqual(data.bits);
                const frames = [...mod.run({ q, n: 4, k: 2, seed })];
                checkFrames(frames);
                expect(frames[frames.length - 1]?.meta["agreed"]).toBe(true);
            }
        }
    });

    it("keeps the residual noise small relative to the modulus", () => {
        for (const seed of [11, 22, 33]) {
            const data = buildFrodo(97, 4, 2, seed);
            for (const value of data.noise.reduce<number[]>((acc, row) => acc.concat(row), [])) {
                expect(Math.abs(value)).toBeLessThanOrEqual(2 * 2 + 1);
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
