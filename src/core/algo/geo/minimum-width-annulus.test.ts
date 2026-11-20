/** minimum-width-annulus.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./minimum-width-annulus";
import type { VisualFrame } from "@/types";

type Pt = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent brute-force scan of midpoint and circumcenter candidates. */
function reference(points: Pt[]): number {
    let best = Infinity;
    const consider = (center: Pt): void => {
        let inner = Infinity;
        let outer = -Infinity;
        for (const p of points) {
            const d = Math.hypot(p[0] - center[0], p[1] - center[1]);
            inner = Math.min(inner, d);
            outer = Math.max(outer, d);
        }
        best = Math.min(best, outer - inner);
    };
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            consider([(points[i]![0] + points[j]![0]) / 2, (points[i]![1] + points[j]![1]) / 2]);
            for (let k = j + 1; k < points.length; k += 1) {
                const [a, b, c] = [points[i]!, points[j]!, points[k]!];
                const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
                if (Math.abs(d) < 1e-9) continue;
                const a2 = a[0] ** 2 + a[1] ** 2;
                const b2 = b[0] ** 2 + b[1] ** 2;
                const c2 = c[0] ** 2 + c[1] ** 2;
                consider([
                    (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
                    (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
                ]);
            }
        }
    }
    return best;
}

describe("Minimum Width Annulus", () => {
    it("matches the brute-force candidate scan", () => {
        const cases: Pt[][] = [
            [[5, 0], [0, 5], [-5, 0], [0, -5], [3.5, 3.5], [-4, 2]],
            [[0, 0], [4, 0], [4, 3], [0, 3], [2, 1]],
            [[1, 1], [2, 5], [6, 2], [7, 7], [3, 3]],
        ];
        for (const points of cases) {
            const frames = [...mod.run({ points })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["bestWidth"])).toBeCloseTo(reference(points), 8);
        }
    });

    it("returns zero width for concyclic points", () => {
        const r = 5 / Math.SQRT2;
        const points: Pt[] = [[5, 0], [0, 5], [-5, 0], [0, -5], [r, r], [-r, r]];
        const frames = [...mod.run({ points })];
        expect(Number(frames[frames.length - 1]?.meta["bestWidth"])).toBeCloseTo(0, 8);
    });

    it("encloses every point between its two radii", () => {
        const points: Pt[] = [[5, 0], [0, 5], [-5, 0], [0, -5], [3.5, 3.5], [-4, 2]];
        const frames = [...mod.run({ points })];
        const meta = frames[frames.length - 1]?.meta;
        const center = meta?.["center"] as Pt;
        const inner = Number(meta?.["innerRadius"]);
        const outer = Number(meta?.["outerRadius"]);
        for (const p of points) {
            const d = Math.hypot(p[0] - center[0], p[1] - center[1]);
            expect(d).toBeGreaterThanOrEqual(inner - 1e-6);
            expect(d).toBeLessThanOrEqual(outer + 1e-6);
        }
        expect(outer - inner).toBeCloseTo(Number(meta?.["bestWidth"]), 8);
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
