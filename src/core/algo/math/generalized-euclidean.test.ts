import { describe, expect, it } from "vitest";
import mod from "./generalized-euclidean";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteGcd(values: number[]): number {
    let g = 0;
    for (const value of values) {
        let a = Math.abs(value);
        let b = g;
        while (b !== 0) {
            const t = a % b;
            a = b;
            b = t;
        }
        g = a;
    }
    return g;
}

interface FinalMeta {
    values: number[];
    gcd: number;
    coefficients: number[];
    check: number;
}

function finalMeta(frames: VisualFrame[]): FinalMeta {
    return frames[frames.length - 1]?.meta as unknown as FinalMeta;
}

describe("Generalized Euclidean Algorithm", () => {
    it("matches brute-force gcd and the Bezout identity on random lists", () => {
        let seed = 40499;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const length = 2 + (trial % 5);
            const values = Array.from({ length }, () => (next() % 200) - 100);
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            expect(meta.gcd).toBe(bruteGcd(values));
            let combination = 0;
            for (let i = 0; i < values.length; i += 1) combination += values[i]! * (meta.coefficients[i] ?? 0);
            expect(combination).toBe(meta.gcd);
            expect(meta.check).toBe(meta.gcd);
        }
    });

    it("handles zeros, negatives, and the default list", () => {
        expect(finalMeta([...mod.run({ values: [0, 0, 0] })]).gcd).toBe(0);
        expect(finalMeta([...mod.run({ values: [-12, 18, -30] })]).gcd).toBe(6);
        expect(finalMeta([...mod.run(mod.defaultInput)]).gcd).toBe(1);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
