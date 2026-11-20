/** beta-vae.test.ts - Brute-force KL, numeric-integration property, beta scaling, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./beta-vae";
import type { VisualFrame } from "@/types";

interface Input {
    mu: number[];
    logvar: number[];
    recon: number;
    beta: number;
}

/** Numerically integrate KL(N(mu,var) || N(0,1)) with Simpson's rule. */
function klByQuadrature(mu: number, variance: number): number {
    const s = Math.sqrt(variance);
    const lo = mu - 10 * s;
    const hi = mu + 10 * s;
    const n = 20000;
    const h = (hi - lo) / n;
    const pdf = (x: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
    const logRatio = (x: number) =>
        -Math.log(s) - ((x - mu) ** 2) / (2 * variance) + (x * x) / 2;
    const f = (x: number) => pdf(x) * logRatio(x);
    let sum = f(lo) + f(hi);
    for (let i = 1; i < n; i += 1) {
        sum += (i % 2 === 0 ? 2 : 4) * f(lo + i * h);
    }
    return (sum * h) / 3;
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    expect(frames[0]?.entities.length).toBe(dim);
}

describe("Beta-VAE objective", () => {
    const cases: Input[] = [
        { mu: [0.5, -1, 0], logvar: [0, -0.5, 0.7], recon: 2.3, beta: 4 },
        { mu: [0, 0], logvar: [0, 0], recon: 1, beta: 1 },
        { mu: [2, -3], logvar: [-2, 1.5], recon: 0.5, beta: 10 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force closed-form KL and objective", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.mu.length);
            const final = frames[frames.length - 1]?.meta;
            const terms = input.mu.map((m, i) => {
                const lv = input.logvar[i]!;
                return 0.5 * (m * m + Math.exp(lv) - 1 - lv);
            });
            const kl = terms.reduce((a, b) => a + b, 0);
            const objective = input.recon + input.beta * kl;
            (final?.["klTerms"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(terms[i]!, 9));
            expect(Number(final?.["kl"])).toBeCloseTo(kl, 9);
            expect(Number(final?.["objective"])).toBeCloseTo(objective, 9);
        }
    });

    it("closed-form KL agrees with numerical integration", () => {
        const muVals = [0, 0.5, -1.5, 2];
        const varVals = [0.2, 1, 2.5];
        for (const mu of muVals) {
            for (const variance of varVals) {
                const closed = 0.5 * (mu * mu + variance - 1 - Math.log(variance));
                const numeric = klByQuadrature(mu, variance);
                expect(Math.abs(closed - numeric)).toBeLessThan(1e-4);
            }
        }
    });

    it("objective scales linearly with beta and KL terms are nonnegative", () => {
        const base = cases[0]!;
        const b1 = [...mod.run({ ...base, beta: 1 })].at(-1)?.meta;
        const b2 = [...mod.run({ ...base, beta: 2 })].at(-1)?.meta;
        const kl = Number(b1?.["kl"]);
        expect(Number(b2?.["objective"]) - Number(b1?.["objective"])).toBeCloseTo(kl, 9);
        (b1?.["klTerms"] as number[]).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
