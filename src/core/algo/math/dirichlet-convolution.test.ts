/** dirichlet-convolution.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./dirichlet-convolution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function brute(f: number[], g: number[], N: number): number[] {
    const h = Array(N + 1).fill(0);
    for (let n = 1; n <= N; n += 1) {
        for (let d = 1; d <= n; d += 1) {
            if (n % d === 0) h[n] += (f[d] ?? 0) * (g[n / d] ?? 0);
        }
    }
    return h.slice(1);
}

describe("Dirichlet convolution", () => {
    it("matches a direct divisor-sum computation", () => {
        const N = 30;
        const f = Array.from({ length: N + 1 }, (_, i) => (i === 0 ? 0 : (i * i + i) % 7 - 3));
        const g = Array.from({ length: N + 1 }, (_, i) => (i === 0 ? 0 : ((i % 5) + 1)));
        const frames = [...mod.run({ n: N, f, g })];
        checkFrames(frames);
        const table = frames[frames.length - 1]?.meta["table"] as number[];
        expect(table).toEqual(brute(f, g, N));
    });

    it("satisfies the identity 1 * id = sigma (sum of divisors)", () => {
        const N = 20;
        const f = Array.from({ length: N + 1 }, (_, i) => (i >= 1 ? 1 : 0));
        const g = Array.from({ length: N + 1 }, (_, i) => i);
        const frames = [...mod.run({ n: N, f, g })];
        const table = frames[frames.length - 1]?.meta["table"] as number[];
        const sigma = (n: number): number => {
            let s = 0;
            for (let d = 1; d <= n; d += 1) if (n % d === 0) s += d;
            return s;
        };
        for (let n = 1; n <= N; n += 1) expect(table[n - 1]).toBe(sigma(n));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
