import { describe, expect, it } from "vitest";
import mod from "./polynomial-gcd-euclid";
import type { VisualFrame } from "@/types";

const PRIME = 1000003;

function trim(poly: number[]): number[] {
    const copy = poly.map((value) => ((value % PRIME) + PRIME) % PRIME);
    let end = copy.length - 1;
    while (end >= 0 && copy[end] === 0) {
        end -= 1;
    }
    return copy.slice(0, end + 1);
}

function multiply(a: number[], b: number[]): number[] {
    const result = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result[i + j] = (result[i + j]! + a[i]! * b[j]!) % PRIME;
        }
    }
    return trim(result);
}

function remainderReference(a: number[], b: number[]): number[] {
    let current = trim(a);
    const divisor = trim(b);
    while (current.length >= divisor.length && divisor.length > 0) {
        const factor = Math.round((current[current.length - 1] ?? 0) / (divisor[divisor.length - 1] ?? 1));
        const shift = current.length - divisor.length;
        const next = current.slice();
        for (let i = 0; i < divisor.length; i += 1) {
            next[i + shift] = ((next[i + shift] ?? 0) - factor * (divisor[i] ?? 0)) % PRIME;
        }
        current = trim(next);
    }
    return current;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Polynomial GCD (Euclid)", () => {
    it("recovers a known common factor from constructed products", () => {
        const g = [-5, 1];
        const a = multiply([1, 1], [2, 1]);
        const b = multiply([3, 1], [4, 1]);
        const p = multiply(g, a);
        const q = multiply(g, b);
        const frames = [...mod.run({ p, q })];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["resultDegree"])).toBe(1);
        expect(last?.meta["dividesP"]).toBe(true);
        expect(last?.meta["dividesQ"]).toBe(true);
    });

    it("handles a polynomial that divides the other exactly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["resultDegree"])).toBe(1);
        expect(last?.meta["dividesP"]).toBe(true);
        expect(last?.meta["dividesQ"]).toBe(true);
        expect(remainderReference([-1, 0, 1], [-1, 1])).toEqual([]);
    });

    it("returns a constant gcd for coprime linear factors", () => {
        const frames = [...mod.run({ p: [1, 1], q: [2, 1] })];
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["resultDegree"])).toBe(0);
        expect(last?.meta["dividesP"]).toBe(true);
        expect(last?.meta["dividesQ"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
