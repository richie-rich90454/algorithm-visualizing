/** quadric-error-metrics.test.ts - Independent error cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./quadric-error-metrics";
import type { VisualFrame } from "@/types";

type Point3 = [number, number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(typeof frame.meta["faces"]).toBe("number");
        expect(Array.isArray(frame.meta["errors"])).toBe(true);
    });
}

/** Independent plane of a triangle, used to recompute QEM error from scratch. */
function planeOf(a: Point3, b: Point3, c: Point3): number[] {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    nx /= length;
    ny /= length;
    nz /= length;
    return [nx, ny, nz, -(nx * a[0] + ny * a[1] + nz * a[2])];
}

function squaredDistance(plane: number[], point: Point3): number {
    const value = plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3];
    return value * value;
}

describe("Quadric Error Metrics", () => {
    it("matches an independent sum-of-squared-plane-distances error", () => {
        const input = mod.defaultInput as { vertices: Point3[]; faces: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const contraction = frames.find((frame) => frame.meta["phase"] === undefined && frame.meta["pair"] !== undefined)
            ?? frames[1];
        expect(contraction).toBeDefined();
        const pair = contraction?.meta["pair"] as number[];
        const point = contraction?.meta["point"] as Point3;
        const reported = contraction?.meta["error"] as number;

        let recomputed = 0;
        for (const face of input.faces) {
            if (face.includes(pair[0]) || face.includes(pair[1])) {
                const a = input.vertices[face[0]] as Point3;
                const b = input.vertices[face[1]] as Point3;
                const c = input.vertices[face[2]] as Point3;
                recomputed += squaredDistance(planeOf(a, b, c), point);
            }
        }
        expect(reported).toBeCloseTo(recomputed, 6);
    });

    it("reduces the face count and keeps the final mesh valid", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const startFaces = frames[0]?.meta["faces"] as number;
        expect(final?.["faces"]).toBeLessThan(startFaces);
        expect(final?.["faces"]).toBeLessThanOrEqual(final?.["targetFaces"] as number);
        const faceList = final?.["faceList"] as number[][];
        const removed = new Set(final?.["removed"] as number[]);
        for (const face of faceList) {
            expect(face).toHaveLength(3);
            expect(new Set(face).size).toBe(3);
            expect(face.some((index) => removed.has(index))).toBe(false);
        }
        const errors = final?.["errors"] as number[];
        expect(errors.length).toBe(final?.["contractions"] as number);
    });

    it("handles a tetrahedron and an already small mesh", () => {
        const vertices: Point3[] = [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 2]];
        const faces = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]];
        const frames = [...mod.run({ vertices, faces, targetFaces: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["faces"]).toBeLessThanOrEqual(2);

        const tiny = [...mod.run({ vertices, faces: [[0, 1, 2]], targetFaces: 4 })];
        checkFrames(tiny);
        expect(tiny[tiny.length - 1]?.meta["contractions"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
