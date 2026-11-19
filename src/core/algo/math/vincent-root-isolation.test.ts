import { describe, expect, it } from "vitest";
import mod from "./vincent-root-isolation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function intervalsFrom(frames: VisualFrame[]): Array<[number, number]> {
    const flat = (frames[frames.length - 1]?.meta["intervals"] as number[]) ?? [];
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pairs.push([flat[i]!, flat[i + 1]!]);
    return pairs;
}

function polyFromRoots(roots: number[]): number[] {
    let coeffs = [1];
    for (const root of roots) {
        const next = new Array<number>(coeffs.length + 1).fill(0);
        for (let i = 0; i < coeffs.length; i += 1) {
            next[i] = (next[i] ?? 0) - root * (coeffs[i] ?? 0);
            next[i + 1] = (next[i + 1] ?? 0) + (coeffs[i] ?? 0);
        }
        coeffs = next;
    }
    return coeffs;
}

function evalPoly(coeffs: number[], x: number): number {
    let value = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) value = value * x + (coeffs[i] ?? 0);
    return value;
}

// Independent dense sign-change scan used as the oracle.
function bruteRoots(coeffs: number[], lo: number, hi: number): number[] {
    const found: number[] = [];
    const steps = 200000;
    const h = (hi - lo) / steps;
    let previous = evalPoly(coeffs, lo);
    for (let i = 1; i <= steps; i += 1) {
        const x = lo + h * i;
        const current = evalPoly(coeffs, x);
        if (previous === 0 || previous * current < 0) found.push(x);
        previous = current;
    }
    return found;
}

describe("Vincent Root Isolation", () => {
    it("isolates exactly the roots found by a dense sign scan", () => {
        const cases = [
            [-2.5, 0.5, 3],
            [-3, -0.5, 2],
            [-1.5, 1.5],
            [-3.5, -2, 0.25, 3.5],
        ];
        for (const roots of cases) {
            const intervals = intervalsFrom([...mod.run({ roots, interval: [-4, 4], maxDepth: 32 })]);
            expect(intervals.length).toBe(roots.length);
            for (const root of roots) {
                expect(intervals.some(([lo, hi]) => root >= lo && root <= hi)).toBe(true);
            }
            const coeffs = polyFromRoots(roots);
            const scanned = bruteRoots(coeffs, -4, 4);
            expect(scanned.length).toBe(roots.length);
            for (const [lo, hi] of intervals) {
                const inInterval = scanned.filter((x) => x >= lo && x <= hi);
                expect(inInterval.length).toBe(1);
                expect(Math.abs(evalPoly(coeffs, lo))).toBeGreaterThan(1e-9);
                expect(Math.abs(evalPoly(coeffs, hi))).toBeGreaterThan(1e-9);
            }
        }
    });

    it("isolates two nearby roots and produces well-formed frames", () => {
        const frames = [...mod.run({ roots: [0.5, 2], interval: [-4, 4], maxDepth: 32 })];
        checkFrames(frames);
        const intervals = intervalsFrom(frames);
        expect(intervals.length).toBe(2);
        for (const root of [0.5, 2]) {
            expect(intervals.some(([lo, hi]) => root >= lo && root <= hi)).toBe(true);
        }
    });

    it("terminates cleanly on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(intervalsFrom(frames).length).toBe(3);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
