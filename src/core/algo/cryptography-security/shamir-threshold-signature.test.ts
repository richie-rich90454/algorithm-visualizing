/**
 * shamir-threshold-signature.test.ts - Lagrange cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./shamir-threshold-signature";
import type { VisualFrame } from "@/types";

const Q = 1009;
function modPow(base: number, exp: number, m: number): number {
    let r = 1;
    let b = ((base % m) + m) % m;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        e = Math.floor(e / 2);
    }
    return r;
}
function inv(value: number): number { return modPow(value, Q - 2, Q); }
function evaluate(coeffs: number[], x: number): number {
    let r = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) r = (r * x + (coeffs[i] ?? 0)) % Q;
    return ((r % Q) + Q) % Q;
}
function reconstruct(shares: Array<{ x: number; y: number }>): number {
    let secret = 0;
    for (let j = 0; j < shares.length; j += 1) {
        const sj = shares[j]!;
        let basis = 1;
        for (let m = 0; m < shares.length; m += 1) {
            if (m === j) continue;
            const sm = shares[m]!;
            basis = (basis * (((-sm.x) % Q + Q) % Q) * inv(((sj.x - sm.x) % Q + Q) % Q)) % Q;
        }
        secret = (secret + sj.y * basis) % Q;
    }
    return secret;
}
function subsets<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    const walk = (start: number, acc: T[]): void => {
        if (acc.length === size) { out.push([...acc]); return; }
        for (let i = start; i < items.length; i += 1) { acc.push(items[i]!); walk(i + 1, acc); acc.pop(); }
    };
    walk(0, []);
    return out;
}

function checkFrames(frames: VisualFrame[], count: number, threshold: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(count + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(index === count + 1 ? threshold : 0);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ShamirThresholdSignature", () => {
    it("every threshold subset reconstructs the secret", () => {
        const input = mod.defaultInput as { secret: number; threshold: number; shares: number; message: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.shares, input.threshold);
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["recovered"])).toBe(input.secret);
        expect(final?.meta["valid"]).toBe(true);

        const coeffs = [input.secret];
        for (let i = 1; i < input.threshold; i += 1) {
            coeffs.push(((input.secret * 31 + i * 17 + 7) % (Q - 1)) + 1);
        }
        const all = Array.from({ length: input.shares }, (_, i) => ({ x: i + 1, y: evaluate(coeffs, i + 1) }));
        for (const subset of subsets(all, input.threshold)) {
            expect(reconstruct(subset)).toBe(input.secret);
        }
        const tooFew = subsets(all, input.threshold - 1);
        expect(tooFew.some((subset) => reconstruct(subset) !== input.secret)).toBe(true);
    });

    it("handles several secrets and thresholds", () => {
        for (const [secret, threshold, shares] of [[7, 2, 4], [500, 4, 6], [1008, 3, 5]]) {
            const frames = [...mod.run({ secret, threshold, shares, message: "MSG" })];
            checkFrames(frames, shares, threshold);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["recovered"])).toBe(secret);
            expect(final?.meta["valid"]).toBe(true);
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
