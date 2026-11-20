/**
 * fruchterman-reingold-layout.test.ts – Correctness and frame checks for Fruchterman-Reingold Layout.
 */

import { describe, expect, it } from "vitest";
import fruchterman from "./fruchterman-reingold-layout";

function framesOf(input: unknown) {
    return [...fruchterman.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = fruchterman.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(fruchterman.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("node");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function positionsOf(frames: ReturnType<typeof framesOf>) {
    const final = frames[frames.length - 1];
    return (final?.entities ?? []).map((e) => [e.x, e.y] as [number, number]);
}

describe("FruchtermanReingoldLayout", () => {
    it("emits well-formed frames that terminate and cool monotonically", () => {
        const frames = framesOf(fruchterman.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        expect(frames.length).toBeLessThan(100);
        checkFrameShape(frames);
        const temps = frames.map((f) => Number(f.meta.temperature)).filter((t) => Number.isFinite(t));
        for (let i = 1; i < temps.length; i += 1) expect(temps[i]!).toBeLessThanOrEqual(temps[i - 1]!);
    });

    it("is deterministic, finite, and spreads vertices to distinct positions", () => {
        const a = positionsOf(framesOf(fruchterman.defaultInput));
        const b = positionsOf(framesOf(fruchterman.defaultInput));
        expect(a).toEqual(b);
        for (const [x, y] of a) {
            expect(Number.isFinite(x)).toBe(true);
            expect(Number.isFinite(y)).toBe(true);
        }
        const unique = new Set(a.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`));
        expect(unique.size).toBe(a.length);
    });

    it("draws a triangle roughly equilateral", () => {
        const graph = { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] };
        const pos = positionsOf(framesOf({ graph, iterations: 80 }));
        const dist = (i: number, j: number) => Math.hypot(pos[i]![0] - pos[j]![0], pos[i]![1] - pos[j]![1]);
        const d = [dist(0, 1), dist(1, 2), dist(0, 2)];
        expect(Math.min(...d)).toBeGreaterThan(0);
        expect(Math.max(...d) / Math.min(...d)).toBeLessThan(3);
    });
});
