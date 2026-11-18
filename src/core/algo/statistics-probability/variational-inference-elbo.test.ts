/**
 * variational-inference-elbo.test.ts - Reference CAVI, independent ELBO identity,
 * monotonicity, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./variational-inference-elbo";
import type { VisualFrame } from "@/types";

/** Independent ELBO via the identity negative KL(q || p) for a normalized target. */
function elboViaIdentity(
    rho: number,
    mu1: number,
    mu2: number,
    m1: number,
    m2: number,
    s1: number,
    s2: number,
): number {
    const det = 1 - rho * rho;
    const l11 = 1 / det;
    const l12 = -rho / det;
    const d1 = m1 - mu1;
    const d2 = m2 - mu2;
    const quadratic = l11 * (s1 + d1 * d1) + 2 * l12 * d1 * d2 + l11 * (s2 + d2 * d2);
    const kl = 0.5 * (quadratic - 2 + Math.log(det) - Math.log(s1 * s2));
    return -kl;
}

/** Independent reference coordinate ascent. */
function reference(rho: number, mu1: number, mu2: number, iterations: number) {
    const det = 1 - rho * rho;
    const factor = rho;
    const variance = det;
    let m1 = 0;
    let m2 = 0;
    for (let i = 0; i < iterations; i += 1) {
        m1 = mu1 + factor * (m2 - mu2);
        m2 = mu2 + factor * (m1 - mu1);
    }
    return { m1, m2, s: variance };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node" && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Variational Inference (ELBO)", () => {
    it("matches an independent coordinate-ascent reference", () => {
        const input = mod.defaultInput as { rho: number; mean: [number, number]; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.rho, input.mean[0], input.mean[1], input.iterations);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["m1"]).toBeCloseTo(expected.m1, 10);
        expect(last?.["m2"]).toBeCloseTo(expected.m2, 10);
        expect(last?.["s1"]).toBeCloseTo(expected.s, 10);
        expect(last?.["s2"]).toBeCloseTo(expected.s, 10);
    });

    it("reports an ELBO equal to log Z minus KL at every frame", () => {
        const input = mod.defaultInput as { rho: number; mean: [number, number]; iterations: number };
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const m = frame.meta;
            const analytic = Number(m["elbo"]);
            const identity = elboViaIdentity(
                input.rho,
                input.mean[0],
                input.mean[1],
                Number(m["m1"]),
                Number(m["m2"]),
                Number(m["s1"]),
                Number(m["s2"]),
            );
            expect(analytic).toBeCloseTo(identity, 9);
        }
    });

    it("increases the ELBO monotonically and reaches the optimal value", () => {
        const rho = 0.6;
        const frames = [...mod.run({ rho, mean: [1.5, -0.5], iterations: 20 })];
        let previous = -Infinity;
        for (const frame of frames) {
            const value = Number(frame.meta["elbo"]);
            expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
            previous = value;
        }
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["m1"])).toBeCloseTo(1.5, 3);
        expect(Number(last?.["m2"])).toBeCloseTo(-0.5, 3);
        expect(Number(last?.["elbo"])).toBeCloseTo(0.5 * Math.log(1 - rho * rho), 3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
