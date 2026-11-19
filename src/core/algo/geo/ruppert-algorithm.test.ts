/** ruppert-algorithm.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./ruppert-algorithm";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
type Tri = [number, number, number];

/** Independent determinant test: is p strictly inside the circle through a, b, c? */
function inCircle(a: Pt, b: Pt, c: Pt, p: Pt): boolean {
    const ax = a[0] - p[0];
    const ay = a[1] - p[1];
    const bx = b[0] - p[0];
    const by = b[1] - p[1];
    const cx = c[0] - p[0];
    const cy = c[1] - p[1];
    const det =
        (ax * ax + ay * ay) * (bx * cy - cx * by) -
        (bx * bx + by * by) * (ax * cy - cx * ay) +
        (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 1e-9;
}

function decodeTriangles(frame: VisualFrame): Tri[] {
    const flat = frame.meta["flatTriangles"] as Array<number | string>;
    const out: Tri[] = [];
    for (let i = 0; i + 2 < flat.length; i += 3) {
        out.push([Number(flat[i]), Number(flat[i + 1]), Number(flat[i + 2])]);
    }
    return out;
}

function framePoints(frame: VisualFrame): Pt[] {
    return frame.entities
        .filter((e) => e.metadata["seed"] === true || e.metadata["seed"] === false)
        .map((e) => e.value as Pt);
}

function minAngle(t: Tri, pts: Pt[]): number {
    const a = pts[t[0]] as Pt;
    const b = pts[t[1]] as Pt;
    const c = pts[t[2]] as Pt;
    const la = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const lb = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const lc = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const ang = (x: number, y: number, z: number) =>
        (Math.acos(Math.max(-1, Math.min(1, (y * y + z * z - x * x) / (2 * y * z)))) * 180) / Math.PI;
    return Math.min(ang(la, lb, lc), ang(lb, la, lc), ang(lc, la, lb));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const pc = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(pc);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ruppert Delaunay refinement", () => {
    it("keeps the final mesh Delaunay around every triangle", () => {
        const input = mod.defaultInput as { points: Pt[]; minAngle: number; maxIterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalFrame = frames[frames.length - 1] as VisualFrame;
        const pts = framePoints(finalFrame);
        const tris = decodeTriangles(finalFrame);
        expect(tris.length).toBeGreaterThan(0);
        expect(pts.length).toBeGreaterThanOrEqual(input.points.length);

        for (const t of tris) {
            const a = pts[t[0]] as Pt;
            const b = pts[t[1]] as Pt;
            const c = pts[t[2]] as Pt;
            for (let i = 0; i < pts.length; i += 1) {
                if (i === t[0] || i === t[1] || i === t[2]) continue;
                expect(inCircle(a, b, c, pts[i] as Pt)).toBe(false);
            }
        }

        const steiner = finalFrame.entities.filter((e) => e.metadata["seed"] === false).length;
        expect(steiner).toBe(Number(finalFrame.meta["steinerPoints"]));
        expect(steiner).toBeGreaterThan(0);
    });

    it("adds Steiner points, grows the mesh, and respects the target when converged", () => {
        const frames = [...mod.run({ points: [[0, 0], [10, 0], [10, 10], [0, 10], [5, 1]], minAngle: 20, maxIterations: 30 })];
        const firstFrame = frames[0] as VisualFrame;
        const initialPts = framePoints(firstFrame);
        const initialTris = decodeTriangles(firstFrame);
        expect(initialTris.length).toBeGreaterThan(0);
        expect(Math.min(...initialTris.map((t) => minAngle(t, initialPts)))).toBeGreaterThan(0);

        const finalFrame = frames[frames.length - 1] as VisualFrame;
        const finalTris = decodeTriangles(finalFrame);
        expect(finalTris.length).toBeGreaterThan(initialTris.length);
        expect(Number(finalFrame.meta["steinerPoints"])).toBeGreaterThan(0);
        expect(Number(finalFrame.meta["iterations"])).toBe(30);
        const finalMin = Number(finalFrame.meta["minAngleDeg"]);
        expect(finalMin).toBeGreaterThanOrEqual(0);
        if (finalFrame.meta["converged"]) {
            expect(finalMin).toBeGreaterThanOrEqual(20 - 1e-6);
        }
    });

    it("handles a second seed configuration", () => {
        const points: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10], [2, 1], [8, 2]];
        const frames = [...mod.run({ points, minAngle: 22, maxIterations: 20 })];
        const finalFrame = frames[frames.length - 1] as VisualFrame;
        const pts = framePoints(finalFrame);
        const tris = decodeTriangles(finalFrame);
        for (const t of tris) {
            for (let i = 0; i < pts.length; i += 1) {
                if (i === t[0] || i === t[1] || i === t[2]) continue;
                expect(inCircle(pts[t[0]] as Pt, pts[t[1]] as Pt, pts[t[2]] as Pt, pts[i] as Pt)).toBe(false);
            }
        }
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
