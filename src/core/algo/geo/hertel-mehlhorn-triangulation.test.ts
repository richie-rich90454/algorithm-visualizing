/** hertel-mehlhorn-triangulation.test.ts - Convex-piece, area, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./hertel-mehlhorn-triangulation";

type Pt = [number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 500; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(500);
    return frames;
}

function convexPolygon(n: number): Pt[] {
    return Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n;
        return [5 * Math.cos(angle), 5 * Math.sin(angle)] as Pt;
    });
}

function area(points: Pt[]): number {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
}

function orientation(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function crosses(p: Pt, q: Pt, r: Pt, s: Pt): boolean {
    return orientation(p, q, r) * orientation(p, q, s) < 0 && orientation(r, s, p) * orientation(r, s, q) < 0;
}

function piecesOf(flat: number[], polygon: Pt[]): Pt[][] {
    const pieces: Pt[][] = [];
    let current: number[] = [];
    for (const v of flat) {
        if (v === -1) {
            pieces.push(current.map((i) => polygon[i]!));
            current = [];
        } else {
            current.push(v);
        }
    }
    return pieces;
}

describe("Hertel-Mehlhorn Convex Partition", () => {
    it("collapses a convex polygon to one piece", () => {
        for (const n of [5, 6, 7, 8]) {
            const polygon = convexPolygon(n);
            const final = framesFor({ polygon }).slice(-1)[0]!;
            expect(final.meta.pieceCount).toBe(1);
            expect((final.meta.removed as number[]).length).toBe((n - 3) * 2);
        }
    });

    it("keeps every piece convex and preserves the total area", () => {
        for (const n of [5, 6, 7, 8]) {
            const polygon = convexPolygon(n);
            const final = framesFor({ polygon }).slice(-1)[0]!;
            const pieces = piecesOf(final.meta.piecesFlat as number[], polygon);
            expect(pieces).toHaveLength(1);
            expect(area(pieces[0]!)).toBeCloseTo(area(polygon), 6);
            for (const piece of pieces) {
                for (let i = 0; i < piece.length; i += 1) {
                    expect(orientation(piece[i]!, piece[(i + 1) % piece.length]!, piece[(i + 2) % piece.length]!)).toBeGreaterThan(0);
                }
            }
        }
    });

    it("produces convex pieces with no crossing diagonals on a notched polygon", () => {
        const input = mod.defaultInput;
        const polygon = (input as { polygon: Pt[] }).polygon;
        const final = framesFor(input).slice(-1)[0]!;
        const pieces = piecesOf(final.meta.piecesFlat as number[], polygon);
        for (const piece of pieces) {
            for (let i = 0; i < piece.length; i += 1) {
                expect(orientation(piece[i]!, piece[(i + 1) % piece.length]!, piece[(i + 2) % piece.length]!)).toBeGreaterThan(0);
            }
        }
        let pieceArea = 0;
        for (const piece of pieces) pieceArea += area(piece);
        expect(pieceArea).toBeCloseTo(area(polygon), 6);
        const flat = final.meta.diagonals as number[];
        const diagonals: Array<[Pt, Pt]> = [];
        for (let i = 0; i < flat.length; i += 2) diagonals.push([polygon[flat[i]!]!, polygon[flat[i + 1]!]!]);
        for (let i = 0; i < diagonals.length; i += 1) {
            for (let j = i + 1; j < diagonals.length; j += 1) {
                expect(crosses(diagonals[i]![0], diagonals[i]![1], diagonals[j]![0], diagonals[j]![1])).toBe(false);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber!).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
