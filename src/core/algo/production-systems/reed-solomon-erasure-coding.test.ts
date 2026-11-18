/**
 * reed-solomon-erasure-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./reed-solomon-erasure-coding";
import type { VisualFrame } from "@/types";

/** Independent GF(256) multiplication using the AES polynomial. */
function mul(a: number, b: number): number {
    let result = 0;
    let x = a;
    let y = b;
    while (y > 0) {
        if ((y & 1) === 1) result ^= x;
        const carry = (x & 0x80) !== 0;
        x = (x << 1) & 0xff;
        if (carry) x ^= 0x1d;
        y >>>= 1;
    }
    return result;
}

const table = new Array<number>(256).fill(0);
(function () {
    let v = 1;
    for (let i = 0; i < 255; i += 1) {
        table[v] = i;
        v = mul(v, 2);
    }
})();
function pow(x: number): number {
    let v = 1;
    for (let i = 0; i < x; i += 1) v = mul(v, 2);
    return v;
}
function inv(a: number): number {
    return pow(255 - (table[a] as number));
}

/** Independent Lagrange evaluation of a polynomial through the given points. */
function evalLagrange(points: Array<[number, number]>, x: number): number {
    let total = 0;
    for (let i = 0; i < points.length; i += 1) {
        const [xi, yi] = points[i] as [number, number];
        let term = yi;
        for (let j = 0; j < points.length; j += 1) {
            if (i === j) continue;
            const xj = points[j]?.[0] as number;
            term = mul(term, mul(x ^ xj, inv(xi ^ xj)));
        }
        total ^= term;
    }
    return total;
}

function encode(data: number[], m: number): number[] {
    const points = data.map((v, i): [number, number] => [i, v]);
    const shards = [...data];
    for (let i = 0; i < m; i += 1) shards.push(evalLagrange(points, data.length + i));
    return shards;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Reed-Solomon Erasure Coding", () => {
    it("matches an independent Lagrange encoder", () => {
        const data = [12, 45, 200, 77];
        const frames = [...mod.run({ data, parityShards: 2, erased: [] })];
        checkFrames(frames, data.length + 2);
        const shards = frames[0]?.meta["shards"] as number[];
        const expected = encode(data, 2);
        expect(shards).toEqual(expected);
        expect(shards.slice(0, data.length)).toEqual(data);
    });

    it("recovers from every choice of lost shards", () => {
        const data = [3, 90, 17, 201];
        const m = 2;
        const n = data.length + m;
        const expected = encode(data, m);
        for (let a = 0; a < n; a += 1) {
            for (let b = a + 1; b < n; b += 1) {
                const frames = [...mod.run({ data, parityShards: m, erased: [a, b] })];
                checkFrames(frames, n);
                const meta = frames[frames.length - 1]?.meta;
                expect(meta?.["recovered"]).toBe(true);
                expect(meta?.["shards"]).toEqual(expected);
            }
        }
    });

    it("detects field arithmetic closure on large bytes", () => {
        const data = [255, 0, 128, 1, 64];
        const frames = [...mod.run({ data, parityShards: 3, erased: [0, 2, 4] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["recovered"]).toBe(true);
        const shards = meta?.["shards"] as number[];
        expect(shards.slice(0, data.length)).toEqual(data);
        expect(shards.every((b) => b >= 0 && b <= 255)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
