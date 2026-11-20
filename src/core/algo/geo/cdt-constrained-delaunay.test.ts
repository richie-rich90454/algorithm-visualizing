/** cdt-constrained-delaunay.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./cdt-constrained-delaunay";
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

describe("Constrained Delaunay Triangulation", () => {
    it("satisfies a single constraint that crosses the Delaunay diagonal", () => {
        const input = mod.defaultInput as { points: Pt[]; constraints: Array<[number, number]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["satisfied"]).toBe(true);
        expect(Number(meta?.["flips"])).toBeGreaterThan(0);
        expect(Number(meta?.["triangles"])).toBe(input.points.length - 2);
        const ids = new Set(frames[frames.length - 1]!.edges.map((e) => e.id));
        expect(ids.has("e-0-2")).toBe(true);
    });

    it("satisfies a constraint on a larger point set", () => {
        const points: Pt[] = [[0, 0], [4, 0], [4, 1], [0, 1], [2, 0.2]];
        const constraints: Array<[number, number]> = [[0, 2]];
        const frames = [...mod.run({ points, constraints })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["satisfied"]).toBe(true);
        expect(Number(meta?.["triangles"])).toBe(4);
        const ids = new Set(frames[frames.length - 1]!.edges.map((e) => e.id));
        for (const [a, b] of constraints) {
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            expect(ids.has(`e-${key}`)).toBe(true);
        }
    });

    it("produces a valid unconstrained Delaunay base", () => {
        const points: Pt[] = [[0, 0], [3, 0], [3, 2], [0, 2], [1.5, 1]];
        const frames = [...mod.run({ points, constraints: [] })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["satisfied"]).toBe(true);
        expect(Number(meta?.["triangles"])).toBeGreaterThan(0);
        expect(Number(meta?.["edges"])).toBeGreaterThanOrEqual(points.length);
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
