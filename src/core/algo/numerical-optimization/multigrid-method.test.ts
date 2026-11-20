/**
 * multigrid-method.test.ts - Direct tridiagonal solve cross-check of the
 * multigrid solution, plus residual reduction, frame-shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./multigrid-method";
import type { VisualFrame } from "@/types";

/** Thomas algorithm for the discrete -u'' = f system on the finest grid. */
function directSolve(f: number[], h: number): number[] {
    const inv = 1 / (h * h);
    const n = f.length;
    const d = new Array<number>(n).fill(2 * inv);
    const rhs = [...f];
    const off = -inv;
    for (let i = 1; i < n; i += 1) {
        const factor = off / (d[i - 1] ?? 1);
        d[i] = (d[i] ?? 0) - factor * off;
        rhs[i] = (rhs[i] ?? 0) - factor * (rhs[i - 1] ?? 0);
    }
    const x = new Array<number>(n).fill(0);
    x[n - 1] = (rhs[n - 1] ?? 0) / (d[n - 1] ?? 1);
    for (let i = n - 2; i >= 0; i -= 1) {
        x[i] = ((rhs[i] ?? 0) - off * (x[i + 1] ?? 0)) / (d[i] ?? 1);
    }
    return x;
}

function checkFrames(frames: VisualFrame[], gridSize: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(gridSize);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Multigrid V-Cycle", () => {
    it("matches a direct tridiagonal solve on the finest grid", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const n = 7;
        checkFrames(frames, n);
        const h = 1 / (n + 1);
        const f = Array.from({ length: n }, (_, i) => Math.PI ** 2 * Math.sin(Math.PI * (i + 1) * h));
        const exact = directSolve(f, h);
        const values = frames[frames.length - 1]?.meta["values"] as number[];
        for (let i = 0; i < n; i += 1) {
            expect(Math.abs((values[i] ?? 0) - (exact[i] ?? 0))).toBeLessThan(1e-5);
        }
    });

    it("reduces the residual norm after each V-cycle", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const cycleFrames = frames.filter((f) => f.meta["phase"] === "correction");
        expect(cycleFrames.length).toBe(6);
        for (let i = 1; i < cycleFrames.length; i += 1) {
            expect(cycleFrames[i]?.meta["residualNorm"] as number).toBeLessThan(
                cycleFrames[i - 1]?.meta["residualNorm"] as number,
            );
        }
        expect(cycleFrames[cycleFrames.length - 1]?.meta["residualNorm"] as number).toBeLessThan(1e-4);
    });

    it("handles a coarser finest grid", () => {
        const frames = [...mod.run({ finest: 3, cycles: 6, sweeps: 2 })];
        checkFrames(frames, 3);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["levels"]).toBe(2);
        expect(finalMeta["residualNorm"] as number).toBeLessThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
