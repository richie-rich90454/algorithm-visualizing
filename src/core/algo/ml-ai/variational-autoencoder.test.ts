/** variational-autoencoder.test.ts - Brute-force forward pass, ELBO identity, reparameterization property. */

import { describe, expect, it } from "vitest";
import mod from "./variational-autoencoder";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[];
    wMu: number[];
    bMu: number;
    wLog: number[];
    bLog: number;
    wDec: number[];
    bDec: number[];
    epsilon: number[];
}

function reference(input: Input) {
    const at = (a: number[], i: number, f: number) => a[i] ?? f;
    let mu = input.bMu;
    let logvar = input.bLog;
    for (let i = 0; i < input.x.length; i += 1) {
        mu += at(input.wMu, i, 0) * input.x[i]!;
        logvar += at(input.wLog, i, 0) * input.x[i]!;
    }
    const z = mu + Math.exp(0.5 * logvar) * at(input.epsilon, 0, 0);
    const xHat = input.x.map((_, i) => at(input.wDec, i, 0) * z + at(input.bDec, i, 0));
    const recon = input.x.reduce((s, v, i) => s + (v - xHat[i]!) ** 2, 0);
    const kl = 0.5 * (mu * mu + Math.exp(logvar) - 1 - logvar);
    return { mu, logvar, z, xHat, recon, kl, elbo: -recon - kl };
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

describe("Variational autoencoder", () => {
    const cases: Input[] = [
        { x: [1, 2, -1], wMu: [0.5, -0.2, 0.3], bMu: 0.1, wLog: [0.1, 0.05, -0.1], bLog: 0, wDec: [0.8, -0.6, 0.4], bDec: [0, 0, 0], epsilon: [0.5] },
        { x: [0, 0], wMu: [1, 1], bMu: 0, wLog: [0, 0], bLog: 0, wDec: [1, 1], bDec: [0, 0], epsilon: [0] },
        { x: [-2, 3], wMu: [0.3, -0.4], bMu: -0.5, wLog: [0.2, 0.1], bLog: 0.05, wDec: [0.7, -0.9], bDec: [0.1, -0.1], epsilon: [-1.5] },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force encoder, sampler, decoder, and ELBO", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.x.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["mu"])).toBeCloseTo(expected.mu, 9);
            expect(Number(final?.["logvar"])).toBeCloseTo(expected.logvar, 9);
            expect(Number(final?.["z"])).toBeCloseTo(expected.z, 9);
            (final?.["xHat"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.xHat[i]!, 9));
            expect(Number(final?.["recon"])).toBeCloseTo(expected.recon, 9);
            expect(Number(final?.["kl"])).toBeCloseTo(expected.kl, 9);
            expect(Number(final?.["elbo"])).toBeCloseTo(expected.elbo, 9);
        }
    });

    it("satisfies the ELBO identity at every frame", () => {
        for (const input of cases) {
            for (const frame of mod.run(input)) {
                const m = frame.meta;
                expect(Number(m["elbo"])).toBeCloseTo(-Number(m["recon"]) - Number(m["kl"]), 9);
            }
        }
    });

    it("noise changes only the sample and downstream values, not mu or logvar", () => {
        const base = cases[0]!;
        const a = [...mod.run(base)].at(-1)?.meta;
        const b = [...mod.run({ ...base, epsilon: [-2] })].at(-1)?.meta;
        expect(Number(a?.["mu"])).toBeCloseTo(Number(b?.["mu"]), 12);
        expect(Number(a?.["logvar"])).toBeCloseTo(Number(b?.["logvar"]), 12);
        expect(Number(a?.["z"])).not.toBeCloseTo(Number(b?.["z"]), 3);
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
