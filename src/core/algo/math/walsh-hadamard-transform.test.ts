/** walsh-hadamard-transform.test.ts - Naive Hadamard matrix comparison and XOR convolution check. */

import { describe, expect, it } from "vitest";
import mod, { walshHadamard, xorConvolution } from "./walsh-hadamard-transform";
import type { VisualFrame } from "@/types";

function popcount(x: number): number {
    let count = 0;
    let v = x;
    while (v > 0) {
        count += v & 1;
        v >>= 1;
    }
    return count;
}

function naiveWh(values: number[]): number[] {
    const n = values.length;
    return Array.from({ length: n }, (_, i) => {
        let sum = 0;
        for (let k = 0; k < n; k += 1) {
            sum += (values[k] ?? 0) * (popcount(i & k) % 2 === 0 ? 1 : -1);
        }
        return sum;
    });
}

function bruteXor(a: number[], b: number[]): number[] {
    const n = Math.max(a.length, b.length);
    const out = new Array<number>(n).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i ^ j] = (out[i ^ j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0);
        }
    }
    return out;
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

describe("Walsh-Hadamard Transform", () => {
    it("matches the naive Hadamard matrix and is an involution up to n", () => {
        for (const n of [1, 2, 4, 8]) {
            for (let trial = 0; trial < 10; trial += 1) {
                const values = Array.from({ length: n }, () => Math.floor(Math.random() * 15) - 7);
                expect(walshHadamard(values)).toEqual(naiveWh(values));
                expect(walshHadamard(walshHadamard(values))).toEqual(values.map((v) => v * n));
            }
        }
    });

    it("computes XOR convolution against a brute-force double loop", () => {
        for (const n of [1, 2, 4, 8]) {
            for (let trial = 0; trial < 10; trial += 1) {
                const a = Array.from({ length: n }, () => Math.floor(Math.random() * 9) - 4);
                const b = Array.from({ length: n }, () => Math.floor(Math.random() * 9) - 4);
                expect(xorConvolution(a, b)).toEqual(bruteXor(a, b));
            }
        }
    });

    it("emits well-formed frames and terminates with the correct result", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["result"]).toEqual(bruteXor([1, 2, 3, 4], [5, 6, 7, 8]));
        expect(generator.next().done).toBe(true);
    });
});
