/**
 * bayesian-information-criterion.test.ts - Independent QR least-squares check,
 * BIC formula properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bayesian-information-criterion";
import type { VisualFrame } from "@/types";

/** Independent least squares via modified Gram-Schmidt QR, returning RSS. */
function rssByQr(xs: number[], ys: number[], degree: number): number {
    const n = xs.length;
    const p = degree + 1;
    const columns: number[][] = Array.from({ length: p }, () => Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < p; j += 1) {
            columns[j][i] = Math.pow(xs[i] ?? 0, j);
        }
    }
    const q: number[][] = [];
    const r: number[][] = Array.from({ length: p }, () => Array<number>(p).fill(0));
    for (let j = 0; j < p; j += 1) {
        const v = [...(columns[j] ?? [])];
        for (let k = 0; k < j; k += 1) {
            const qk = q[k] ?? [];
            const rkj = (qk.reduce((s, val, i) => s + val * (v[i] ?? 0), 0));
            r[k][j] = rkj;
            for (let i = 0; i < n; i += 1) v[i] = (v[i] ?? 0) - rkj * (qk[i] ?? 0);
        }
        const norm = Math.sqrt(v.reduce((s, val) => s + val * val, 0));
        r[j][j] = norm;
        q.push(v.map((val) => (norm > 0 ? val / norm : 0)));
    }
    const qty: number[] = q.map((qj) => qj.reduce((s, val, i) => s + val * (ys[i] ?? 0), 0));
    const beta = Array<number>(p).fill(0);
    for (let i = p - 1; i >= 0; i -= 1) {
        let sum = qty[i] ?? 0;
        for (let j = i + 1; j < p; j += 1) sum -= (r[i][j] ?? 0) * (beta[j] ?? 0);
        beta[i] = (r[i][i] ?? 0) !== 0 ? sum / (r[i][i] ?? 1) : 0;
    }
    let rss = 0;
    for (let i = 0; i < n; i += 1) {
        let fit = 0;
        for (let j = 0; j < p; j += 1) fit += (beta[j] ?? 0) * Math.pow(xs[i] ?? 0, j);
        rss += Math.pow((ys[i] ?? 0) - fit, 2);
    }
    return rss;
}

function bicFromRss(rss: number, n: number, k: number): number {
    const logL = (-n / 2) * (Math.log(2 * Math.PI * (rss / n)) + 1);
    return -2 * logL + k * Math.log(n);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar" && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Bayesian Information Criterion", () => {
    it("matches independent QR least squares for every candidate", () => {
        const input = mod.defaultInput as { x: number[]; y: number[]; maxDegree: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const perDegree = frames.slice(1, -1);
        expect(perDegree.length).toBe(input.maxDegree + 1);
        let previousRss = Infinity;
        for (const frame of perDegree) {
            const degree = Number(frame.meta["degree"]);
            const expectedRss = rssByQr(input.x, input.y, degree);
            expect(Number(frame.meta["rss"])).toBeCloseTo(expectedRss, 6);
            expect(Number(frame.meta["rss"])).toBeLessThanOrEqual(previousRss + 1e-6);
            previousRss = Number(frame.meta["rss"]);
            const expectedBic = bicFromRss(expectedRss, input.x.length, Number(frame.meta["k"]));
            expect(Number(frame.meta["bic"])).toBeCloseTo(expectedBic, 6);
        }
    });

    it("selects the smallest BIC and penalizes more than AIC for large n", () => {
        const input = mod.defaultInput as { x: number[]; y: number[]; maxDegree: number };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const candidates = final?.["candidates"] as number[];
        const valid = candidates.filter((v) => v !== -1);
        const minBic = Math.min(...valid);
        expect(Number(final?.["bestBic"])).toBeCloseTo(minBic, 9);
        const bestDegree = Number(final?.["bestDegree"]);
        expect(bestDegree).toBeGreaterThanOrEqual(1);
        expect(bestDegree).toBeLessThanOrEqual(3);

        const bigX = Array.from({ length: 30 }, (_, i) => i / 3);
        const bigY = bigX.map((x) => 1 + 0.5 * x * x + 0.01 * x);
        const bigFrames = [...mod.run({ x: bigX, y: bigY, maxDegree: 3 })];
        const lastFrame = bigFrames[bigFrames.length - 2];
        const aic = Number(lastFrame?.meta["aic"]);
        const bic = Number(lastFrame?.meta["bic"]);
        expect(bigX.length).toBeGreaterThan(8);
        expect(bic).toBeGreaterThan(aic);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
