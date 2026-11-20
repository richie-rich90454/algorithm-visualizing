/**
 * proactive-secret-sharing.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./proactive-secret-sharing";
import type { VisualFrame } from "@/types";

interface Input {
    secret: number;
    threshold: number;
    parties: number;
    p: number;
    seed: number[];
}

/** Independent polynomial evaluation via an explicit power sum. */
function evalPoly(coeffs: number[], x: number, p: number): number {
    let total = 0;
    for (let i = 0; i < coeffs.length; i += 1) total = (total + coeffs[i]! * (x ** i)) % p;
    return ((total % p) + p) % p;
}

/** Independent inverse by Fermat-like brute force in a prime field. */
function inv(value: number, p: number): number {
    const v = ((value % p) + p) % p;
    for (let i = 1; i < p; i += 1) if ((v * i) % p === 1) return i;
    return 1;
}

/** Independent Lagrange interpolation at zero. */
function interpolate(points: Array<{ x: number; y: number }>, p: number): number {
    let sum = 0;
    for (const point of points) {
        let term = 1;
        for (const other of points) {
            if (other === point) continue;
            term = (term * -other.x * inv(point.x - other.x, p)) % p;
        }
        sum = (sum + point.y * term) % p;
    }
    return ((sum % p) + p) % p;
}

/** Reference for the full proactive refresh flow. */
function reference(input: Input) {
    const { secret, threshold: t, parties: n, p, seed } = input;
    let cursor = 0;
    const next = () => {
        const value = ((seed[cursor % seed.length] ?? 0) + cursor * 17) % p;
        cursor += 1;
        return value;
    };
    const secretPoly = [secret];
    for (let d = 1; d < t; d += 1) secretPoly.push(next());
    const old = Array.from({ length: n }, (_, i) => evalPoly(secretPoly, i + 1, p));
    const refresh = Array.from({ length: n }, () => {
        const coeffs = [0];
        for (let d = 1; d < t; d += 1) coeffs.push(next());
        return coeffs;
    });
    const contributions = Array.from({ length: n }, (_, receiver) =>
        refresh.reduce((sum, poly) => (sum + evalPoly(poly, receiver + 1, p)) % p, 0),
    );
    const fresh = old.map((value, i) => (value + contributions[i]!) % p);
    const pts = (values: number[], count: number) => values.slice(0, count).map((y, i) => ({ x: i + 1, y }));
    return { old, fresh, oldResult: interpolate(pts(old, t), p), freshResult: interpolate(pts(fresh, t), p) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proactive Secret Sharing", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent refresh and reconstructs the secret twice", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        expect(final?.["oldShares"]).toEqual(expected.old);
        expect(final?.["newShares"]).toEqual(expected.fresh);
        expect(final?.["oldResult"]).toBe(input.secret);
        expect(final?.["newResult"]).toBe(input.secret);
        expect(final?.["match"]).toBe(1);
        expect(final?.["mixed"]).not.toBe(input.secret);
    });

    it("works across thresholds, party counts and secrets", () => {
        const cases: Input[] = [
            { secret: 5, threshold: 2, parties: 3, p: 257, seed: [2, 4, 6, 8] },
            { secret: 200, threshold: 3, parties: 5, p: 257, seed: [13, 29, 47] },
            { secret: 77, threshold: 4, parties: 6, p: 257, seed: [3, 5, 7, 11, 13] },
        ];
        for (const testInput of cases) {
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testInput);
            expect(final?.["newShares"]).toEqual(expected.fresh);
            expect(final?.["newResult"]).toBe(testInput.secret);
            expect(final?.["match"]).toBe(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
