import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./lone-divider-method";

type Interval = [number, number];

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(Array.isArray(f.entities)).toBe(true);
        expect(f.edges).toEqual([]);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function value(of: Interval, a: number, b: number): number {
    return Math.max(0, Math.min(b, of[1]) - Math.max(a, of[0])) / (of[1] - of[0]);
}

describe("LoneDividerMethod", () => {
    const cases: Interval[][] = [
        [[0, 0.6], [0.2, 1], [0.4, 0.8]],
        [[0, 0.35], [0.3, 0.7], [0.65, 1], [0.15, 0.85]],
        [[0, 1], [0, 1], [0, 1]],
    ];

    it("gives every player a contiguous piece worth at least a fair share", () => {
        for (const intervals of cases) {
            const fs = frames({ intervals });
            shapes(fs);
            const last = fs[fs.length - 1];
            const pieces = JSON.parse(String(last?.meta.assignments)) as Array<{ player: number; start: number; end: number; value: number }>;
            const share = 1 / intervals.length;
            expect(pieces.length).toBe(intervals.length);
            expect(new Set(pieces.map((p) => p.player)).size).toBe(intervals.length);
            expect(pieces[0]?.start).toBeCloseTo(0, 6);
            for (let i = 1; i < pieces.length; i += 1) {
                expect(pieces[i]!.start).toBeCloseTo(pieces[i - 1]!.end, 4);
            }
            for (const piece of pieces) {
                const of = intervals[piece.player]!;
                expect(value(of, piece.start, piece.end)).toBeCloseTo(piece.value, 6);
                expect(piece.value).toBeGreaterThanOrEqual(share - 1e-4);
            }
        }
    });

    it("reports a minimum value meeting the share and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        expect(Number(fs[fs.length - 1]?.meta.minValue)).toBeGreaterThanOrEqual(1 / 3 - 1e-4);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
