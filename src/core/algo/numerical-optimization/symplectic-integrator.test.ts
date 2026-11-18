/**
 * symplectic-integrator.test.ts - Reference-iteration, energy and area checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./symplectic-integrator";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Symplectic Integrator", () => {
    it("matches an independent symplectic-Euler loop", () => {
        const dt = 0.03;
        const steps = 300;
        const omega = 1.5;
        const k = omega * omega;
        let q = 1;
        let p = 0;
        const frames = [...mod.run({ q0: 1, p0: 0, dt, steps, omega })];
        checkFrames(frames);
        for (let n = 1; n <= steps; n += 1) {
            p = p - dt * k * q;
            q = q + dt * p;
            const meta = frames[n]!.meta;
            expect(Number(meta["q"])).toBeCloseTo(q, 10);
            expect(Number(meta["p"])).toBeCloseTo(p, 10);
        }
    });

    it("keeps energy bounded over many steps (no secular drift)", () => {
        const input = { q0: 1, p0: 0, dt: 0.01, steps: 5000, omega: 1 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["maxDrift"])).toBeLessThan(0.05);
        const early = frames[100]!.meta["energy"] as number;
        const late = frames[frames.length - 2]!.meta["energy"] as number;
        expect(Math.abs(late - early)).toBeLessThan(0.02);
    });

    it("preserves phase-space area (symplectic determinant is one)", () => {
        const dt = 0.08;
        const k = 1;
        // Jacobian of the map has determinant (1 - dt^2 k) * 1 - dt * (-dt k) = 1.
        const det = (1 - dt * dt * k) - dt * (-dt * k);
        expect(det).toBeCloseTo(1, 12);
        // Numerically: evolve two perturbation directions and compare the area they span.
        const evolve = (q: number, p: number) => {
            const pn = p - dt * k * q;
            return { q: q + dt * pn, p: pn };
        };
        const base = evolve(1, 0);
        const dq = 1e-3;
        const dp = 2e-3;
        const alongQ = evolve(1 + dq, 0);
        const alongP = evolve(1, dp);
        const v1 = { q: alongQ.q - base.q, p: alongQ.p - base.p };
        const v2 = { q: alongP.q - base.q, p: alongP.p - base.p };
        const areaAfter = Math.abs(v1.q * v2.p - v1.p * v2.q);
        expect(areaAfter).toBeCloseTo(dq * dp, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
