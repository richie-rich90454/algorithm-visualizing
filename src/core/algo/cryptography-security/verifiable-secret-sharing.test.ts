/**
 * verifiable-secret-sharing.test.ts - Independent interpolation reference,
 * verification property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { verify } from "./verifiable-secret-sharing";
import type { VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;

function power(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = base % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Recover the constant term by solving the Vandermonde system directly. */
function solveConstant(points: Array<{ x: number; y: number }>): number {
    const n = points.length;
    const rows = points.map((point) => {
        const coefficients: number[] = [];
        for (let j = 0; j < n; j += 1) {
            coefficients.push(power(point.x, j, Q));
        }
        return [...coefficients, ((point.y % Q) + Q) % Q];
    });
    for (let column = 0; column < n; column += 1) {
        let pivot = column;
        while (pivot < n && rows[pivot]?.[column] === 0) {
            pivot += 1;
        }
        const row = rows[pivot];
        const target = rows[column];
        if (!row || !target) {
            break;
        }
        rows[pivot] = target;
        rows[column] = row;
        const inverse = power(row[column] ?? 1, Q - 2, Q);
        for (let j = 0; j <= n; j += 1) {
            rows[column]![j] = ((row[j] ?? 0) * inverse) % Q;
        }
        for (let i = 0; i < n; i += 1) {
            if (i === column) {
                continue;
            }
            const factor = rows[i]?.[column] ?? 0;
            for (let j = 0; j <= n; j += 1) {
                const current = rows[i]?.[j] ?? 0;
                rows[i]![j] = (current - factor * (rows[column]?.[j] ?? 0) + Q * Q) % Q;
            }
        }
    }
    return ((rows[0]?.[n] ?? 0) % Q + Q) % Q;
}

function checkFrames(frames: VisualFrame[], shareCount: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThanOrEqual(shareCount);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Verifiable Secret Sharing", () => {
    it("matches an independent linear-system reconstruction on the default input", () => {
        const input = mod.defaultInput as { secret: number; threshold: number; shares: number };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.shares);
        const final = frames[frames.length - 1]?.meta;
        const shares = final?.["shares"] as number[];
        const points = shares.slice(0, input.threshold).map((y, index) => ({ x: index + 1, y }));
        expect(final?.["reconstructed"]).toBe(solveConstant(points));
        expect(final?.["reconstructed"]).toBe(input.secret);
        expect(final?.["verdicts"]).toEqual(shares.map(() => 1));
    });

    it("verifies every honest share and rejects a tampered one", () => {
        const coefficients = [7, 3, 5];
        const commitments = coefficients.map((value) => power(G, value, P));
        for (let x = 1; x <= 5; x += 1) {
            const share = coefficients.reduce((sum, value, index) => sum + value * power(x, index, Q), 0) % Q;
            expect(verify(commitments, x, share)).toBe(true);
            expect(verify(commitments, x, (share + 1) % Q)).toBe(false);
        }
    });

    it("reconstructs every secret in the field", () => {
        for (let secret = 0; secret < Q; secret += 1) {
            const frames = [...mod.run({ secret, threshold: 3, shares: 5 })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["reconstructed"]).toBe(secret);
            expect(final?.["verdicts"]).toEqual([1, 1, 1, 1, 1]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
