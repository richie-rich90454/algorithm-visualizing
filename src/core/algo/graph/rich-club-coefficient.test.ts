import { describe, expect, it } from "vitest";
import mod from "./rich-club-coefficient";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

interface CurvePoint {
    k: number;
    size: number;
    internal: number;
    phi: number;
}

function bruteCurve(edges: Array<[string, string]>): CurvePoint[] {
    const degree = new Map<string, number>();
    const unique = new Set<string>();
    const pairs: Array<[string, string]> = [];
    for (const [a, b] of edges) {
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!unique.has(key)) {
            unique.add(key);
            pairs.push([a, b]);
        }
    }
    const maxDegree = Math.max(0, ...degree.values());
    const result: CurvePoint[] = [];
    for (let k = 0; k < maxDegree; k += 1) {
        const club = new Set([...degree].filter(([, d]) => d > k).map(([v]) => v));
        const internal = pairs.filter(([a, b]) => club.has(a) && club.has(b)).length;
        const possible = (club.size * (club.size - 1)) / 2;
        result.push({ k, size: club.size, internal, phi: possible > 0 ? internal / possible : 1 });
    }
    return result;
}

describe("Rich-Club Coefficient", () => {
    it("matches a brute-force density curve on the default graph", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const thresholds = meta["thresholds"] as number[];
        const phi = meta["phi"] as number[];
        const clubSizes = meta["clubSizes"] as number[];
        const clubEdges = meta["clubEdges"] as number[];
        const expected = bruteCurve(input.edges);
        expect(thresholds.length).toBe(expected.length);
        expected.forEach((point, index) => {
            expect(thresholds[index]).toBe(point.k);
            expect(clubSizes[index]).toBe(point.size);
            expect(clubEdges[index]).toBe(point.internal);
            expect(phi[index]).toBeCloseTo(point.phi, 9);
            expect(phi[index]!).toBeGreaterThanOrEqual(0);
            expect(phi[index]!).toBeLessThanOrEqual(1);
        });
    });

    it("gives density one for a complete clique at every threshold", () => {
        const edges: Array<[string, string]> = [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"]];
        const frames = [...mod.run({ edges })];
        const meta = frames[frames.length - 1]!.meta;
        for (const value of meta["phi"] as number[]) {
            expect(value).toBeCloseTo(1, 9);
        }
        for (const point of bruteCurve(edges)) {
            expect(point.phi).toBeCloseTo(1, 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
