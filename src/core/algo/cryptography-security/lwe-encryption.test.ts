/**
 * lwe-encryption.test.ts - LWE equation checks, bit round trips, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./lwe-encryption";
import type { VisualFrame } from "@/types";

interface Input {
    message: number;
    q: number;
    n: number;
    seed: number;
}

const modq = (value: number, q: number): number => ((value % q) + q) % q;
const centered = (value: number, q: number): number => {
    const r = modq(value, q);
    return r > q / 2 ? r - q : r;
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(20);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(10);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LWE Encryption", () => {
    it("satisfies the public-key and ciphertext equations exactly", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const q = Number(final?.["q"]);
        const n = Number(final?.["n"]);
        const s = final?.["s"] as number[];
        const e = final?.["e"] as number[];
        const b = final?.["b"] as number[];
        const u = final?.["u"] as number[];
        const v = Number(final?.["v"]);
        const message = Number(final?.["message"]);

        // Recover A from the earlier frame, which exposes the full matrix.
        const keyFrame = frames[2]?.meta;
        const flatA = keyFrame?.["A"] as number[];
        const getA = (i: number, j: number): number => flatA[i * n + j] ?? 0;

        for (let i = 0; i < n; i += 1) {
            let dot = e[i] ?? 0;
            for (let j = 0; j < n; j += 1) {
                dot += getA(i, j) * (s[j] ?? 0);
            }
            expect(b[i]).toBe(modq(dot, q));
        }

        const rFrame = frames[3]?.meta;
        const r = rFrame?.["r"] as number[];
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let i = 0; i < n; i += 1) {
                sum += (r[i] ?? 0) * getA(i, j);
            }
            expect(u[j]).toBe(modq(sum, q));
        }
        let rv = 0;
        for (let i = 0; i < n; i += 1) {
            rv += (r[i] ?? 0) * (b[i] ?? 0);
        }
        expect(v).toBe(modq(rv + message * Math.floor(q / 2), q));

        let uDotS = 0;
        for (let j = 0; j < n; j += 1) {
            uDotS += (u[j] ?? 0) * (s[j] ?? 0);
        }
        const noise = centered(v - uDotS - message * Math.floor(q / 2), q);
        expect(Number(final?.["noise"])).toBe(noise);
        expect(Math.abs(noise)).toBeLessThanOrEqual(n);
    });

    it("round-trips both bits across several seeds", () => {
        for (const q of [97, 101, 127]) {
            for (const seed of [1, 7, 20261118, 999983]) {
                for (const message of [0, 1]) {
                    const frames = [...mod.run({ message, q, n: 4, seed })];
                    checkFrames(frames);
                    const final = frames[frames.length - 1]?.meta;
                    expect(final?.["decrypted"]).toBe(message);
                    expect(final?.["agreed"]).toBe(true);
                }
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
