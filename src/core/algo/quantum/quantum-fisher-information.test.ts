/**
 * quantum-fisher-information.test.ts - Closed-form agreement, an independent
 * finite-difference recomputation, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-fisher-information";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function grid(meta: Record<string, MetaValue>): number[][] {
    const raw = meta["grid"];
    return Array.isArray(raw)
        ? raw.map((r) => (r as MetaValue[]).map((v) => Number(v)))
        : [];
}

/** Independent brute-force QFI integral for a two-amplitude pure state. */
function bruteQfi(stateFn: (t: number) => Array<[number, number]>, theta: number): number {
    const h = 1e-4;
    const plus = stateFn(theta + h);
    const minus = stateFn(theta - h);
    const psi = stateFn(theta);
    let norm = 0;
    let ovRe = 0;
    let ovIm = 0;
    for (let i = 0; i < 2; i += 1) {
        const dRe = (plus[i]![0] - minus[i]![0]) / (2 * h);
        const dIm = (plus[i]![1] - minus[i]![1]) / (2 * h);
        norm += dRe * dRe + dIm * dIm;
        ovRe += psi[i]![0] * dRe + psi[i]![1] * dIm;
        ovIm += psi[i]![0] * dIm - psi[i]![1] * dRe;
    }
    return 4 * (norm - (ovRe * ovRe + ovIm * ovIm));
}

describe("Quantum Fisher information", () => {
    it("matches the amplitude-model closed form", () => {
        const frames = [...mod.run({ model: "amplitude", coefficient: 1 })];
        checkFrames(frames);
        const rows = grid(frames[frames.length - 1]!.meta);
        expect(rows.length).toBeGreaterThan(2);
        for (const row of rows) {
            expect(row[1]!).toBeCloseTo(row[2]!, 3);
            expect(row[3]!).toBeLessThan(1e-3);
        }
        expect(Number(frames[frames.length - 1]!.meta["maxError"])).toBeLessThan(1e-3);
    });

    it("matches the phase-model closed form for several angles", () => {
        for (const alpha of [Math.PI / 6, Math.PI / 4, Math.PI / 8]) {
            const frames = [...mod.run({ model: "phase", alpha })];
            checkFrames(frames);
            const rows = grid(frames[frames.length - 1]!.meta);
            for (const row of rows) {
                expect(row[1]!).toBeCloseTo(Math.sin(2 * alpha) ** 2, 3);
            }
        }
    });

    it("agrees with an independent finite-difference recomputation", () => {
        const alpha = Math.PI / 5;
        const frames = [...mod.run({ model: "phase", alpha })];
        checkFrames(frames);
        const rows = grid(frames[frames.length - 1]!.meta);
        const stateFn = (t: number): Array<[number, number]> => [
            [Math.cos(alpha), 0],
            [Math.sin(alpha) * Math.cos(t), Math.sin(alpha) * Math.sin(t)],
        ];
        for (const row of rows) {
            expect(row[1]!).toBeCloseTo(bruteQfi(stateFn, row[0]!), 3);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
