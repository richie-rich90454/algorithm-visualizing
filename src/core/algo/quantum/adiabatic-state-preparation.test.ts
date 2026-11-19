/**
 * adiabatic-state-preparation.test.ts - Evolution correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adiabatic-state-preparation";
import type { VisualFrame } from "@/types";

type C = { re: number; im: number };
const cmul = (x: C, y: C): C => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re });
const cadd = (x: C, y: C): C => ({ re: x.re + y.re, im: x.im + y.im });
const cabs2 = (x: C): number => x.re * x.re + x.im * x.im;

/** Reference evolution built from explicit 2x2 matrix entries. */
function referenceOverlap(steps: number, totalTime: number): number {
    const dt = totalTime / steps;
    let a: C = { re: 0, im: 0 };
    let b: C = { re: 1, im: 0 };
    for (let k = 0; k < steps; k += 1) {
        const s = steps > 1 ? k / (steps - 1) : 1;
        const vx = s;
        const vz = 1 - s;
        const r = Math.hypot(vx, vz);
        const cosine = Math.cos(r * dt);
        const sine = Math.sin(r * dt) / r;
        const iSvz: C = { re: 0, im: -sine * vz };
        const iSvx: C = { re: 0, im: -sine * vx };
        const u00 = { re: cosine + iSvz.re, im: iSvz.im };
        const u01 = iSvx;
        const u11 = { re: cosine - iSvz.re, im: -iSvz.im };
        const na = cadd(cmul(u00, a), cmul(u01, b));
        const nb = cadd(cmul(u01, a), cmul(u11, b));
        a = na;
        b = nb;
    }
    const inv = 1 / Math.SQRT2;
    return cabs2(cadd(cmul({ re: inv, im: 0 }, a), cmul({ re: -inv, im: 0 }, b)));
}

function checkFrames(frames: VisualFrame[], snapshots: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(snapshots);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Adiabatic state preparation", () => {
    it("matches an independent matrix-based evolution", () => {
        const steps = 120;
        const totalTime = 20;
        const frames = [...mod.run({ steps, totalTime })];
        checkFrames(frames, 12);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["targetOverlap"])).toBeCloseTo(referenceOverlap(steps, totalTime), 7);
        expect(Number(final["finalGroundProb"])).toBeGreaterThan(0.9);
    });

    it("a slower sweep stays closer to the ground state", () => {
        const overlap = (totalTime: number) => {
            const frames = [...mod.run({ steps: 160, totalTime })];
            return Number(frames[frames.length - 1]!.meta["targetOverlap"]);
        };
        expect(overlap(20)).toBeGreaterThan(overlap(1));
        expect(overlap(40)).toBeGreaterThan(overlap(10));
    });

    it("keeps the overlap curve in range and finishes near one", () => {
        const frames = [...mod.run({ steps: 120, totalTime: 20 })];
        const curve = frames[frames.length - 1]!.meta["groundProbs"] as number[];
        for (const value of curve) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
        expect(curve[curve.length - 1]!).toBeGreaterThan(0.9);
        expect(curve[0]!).toBeGreaterThan(0.9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
