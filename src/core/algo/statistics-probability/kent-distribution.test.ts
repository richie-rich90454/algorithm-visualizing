/**
 * kent-distribution.test.ts - Property and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { kentBasis, kentLogDensity, kentNormalizer } from "./kent-distribution";
import type { VisualFrame } from "@/types";

type Vec3 = [number, number, number];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Independent surface integral using a finer, offset grid. */
function referenceNormalizer(kappa: number, beta: number, basis: [Vec3, Vec3, Vec3]): number {
    const uSteps = 120;
    const phiSteps = 240;
    const du = 2 / uSteps;
    const dphi = (2 * Math.PI) / phiSteps;
    let total = 0;
    for (let i = 0; i < uSteps; i += 1) {
        const u = -1 + (i + 0.5) * du;
        const r = Math.sqrt(Math.max(0, 1 - u * u));
        for (let j = 0; j < phiSteps; j += 1) {
            const phi = (j + 0.25) * dphi;
            const x: Vec3 = [r * Math.cos(phi), r * Math.sin(phi), u];
            total += Math.exp(kentLogDensity(x, kappa, beta, basis));
        }
    }
    return total * du * dphi;
}

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["samples"])).toBe(true);
    });
}

describe("Kent distribution", () => {
    it("builds an orthonormal basis", () => {
        const basis = kentBasis(0.9, 0.6);
        expect(dot(basis[0], basis[0])).toBeCloseTo(1, 10);
        expect(dot(basis[1], basis[1])).toBeCloseTo(1, 10);
        expect(dot(basis[2], basis[2])).toBeCloseTo(1, 10);
        expect(dot(basis[0], basis[1])).toBeCloseTo(0, 10);
        expect(dot(basis[0], basis[2])).toBeCloseTo(0, 10);
        expect(dot(basis[1], basis[2])).toBeCloseTo(0, 10);
    });

    it("has the correct density at the mean, shape, and orthogonal directions", () => {
        const basis = kentBasis(0.7, 1.1);
        expect(kentLogDensity(basis[0], 5, 1.5, basis)).toBeCloseTo(5, 10);
        expect(kentLogDensity(basis[1], 5, 1.5, basis)).toBeCloseTo(1.5, 10);
        expect(kentLogDensity(basis[2], 5, 1.5, basis)).toBeCloseTo(-1.5, 10);
    });

    it("is rotationally symmetric about the mean when beta is zero", () => {
        const basis = kentBasis(0.6, 0.3);
        const a: Vec3 = [basis[0][0], basis[0][1], basis[0][2]];
        const b: Vec3 = [basis[1][0] * 0.6 + basis[2][0] * 0.8, basis[1][1] * 0.6 + basis[2][1] * 0.8, basis[1][2] * 0.6 + basis[2][2] * 0.8];
        expect(dot(b, b)).toBeCloseTo(1, 10);
        expect(kentLogDensity(a, 3, 0, basis)).toBeCloseTo(3, 10);
        expect(kentLogDensity(b, 3, 0, basis)).toBeCloseTo(0, 10);
        // Equal alignment means equal log density regardless of the azimuth.
        const c: Vec3 = [basis[0][0] * 0.5 + basis[1][0] * Math.sqrt(0.75), basis[0][1] * 0.5 + basis[1][1] * Math.sqrt(0.75), basis[0][2] * 0.5 + basis[1][2] * Math.sqrt(0.75)];
        const d: Vec3 = [basis[0][0] * 0.5 + basis[2][0] * Math.sqrt(0.75), basis[0][1] * 0.5 + basis[2][1] * Math.sqrt(0.75), basis[0][2] * 0.5 + basis[2][2] * Math.sqrt(0.75)];
        expect(kentLogDensity(c, 3, 0, basis)).toBeCloseTo(kentLogDensity(d, 3, 0, basis), 10);
    });

    it("matches an independent quadrature for the normalizer", () => {
        const basis = kentBasis(0.9, 0.6);
        const z = kentNormalizer(4, 1, basis);
        const reference = referenceNormalizer(4, 1, basis);
        expect(Math.abs(z - reference) / reference).toBeLessThan(0.02);
        expect(z).toBeGreaterThan(0);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { steps: number };
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, input.steps);
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["peakDensity"])).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
