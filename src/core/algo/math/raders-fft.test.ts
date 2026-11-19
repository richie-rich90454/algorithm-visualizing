/** raders-fft.test.ts - Independent naive DFT comparison and primitive-root properties. */

import { describe, expect, it } from "vitest";
import mod, { powMod, primitiveRoot, radersDft } from "./raders-fft";
import type { VisualFrame } from "@/types";

function naiveDft(values: number[], p: number): { re: number[]; im: number[] } {
    const re = new Array<number>(p).fill(0);
    const im = new Array<number>(p).fill(0);
    for (let k = 0; k < p; k += 1) {
        for (let n = 0; n < p; n += 1) {
            const angle = (-2 * Math.PI * k * n) / p;
            re[k] = (re[k] ?? 0) + (values[n] ?? 0) * Math.cos(angle);
            im[k] = (im[k] ?? 0) + (values[n] ?? 0) * Math.sin(angle);
        }
    }
    return { re, im };
}

function close(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-8;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Rader's FFT", () => {
    it("finds genuine primitive roots for small primes", () => {
        for (const p of [3, 5, 7, 11, 13, 17, 19, 23]) {
            const g = primitiveRoot(p);
            const powers = new Set<number>();
            for (let i = 0; i < p - 1; i += 1) powers.add(powMod(g, i, p));
            expect(powers.size).toBe(p - 1);
            expect(powMod(g, p - 1, p)).toBe(1);
        }
    });

    it("matches a naive DFT for several prime lengths and random inputs", () => {
        for (const p of [3, 5, 7, 11, 13]) {
            for (let trial = 0; trial < 8; trial += 1) {
                const x = Array.from({ length: p }, () => Math.floor(Math.random() * 21) - 10);
                const got = radersDft(x, p);
                const want = naiveDft(x, p);
                expect(got.re.length).toBe(p);
                for (let k = 0; k < p; k += 1) {
                    expect(close(got.re[k] ?? 0, want.re[k] ?? 0)).toBe(true);
                    expect(close(got.im[k] ?? 0, want.im[k] ?? 0)).toBe(true);
                }
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const want = naiveDft([1, 2, 3, 4, 5], 5);
        const final = frames[frames.length - 1];
        const re = final?.meta["real"] as number[];
        for (let k = 0; k < 5; k += 1) expect(close(re[k] ?? 0, want.re[k] ?? 0)).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
