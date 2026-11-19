/** dual-contouring.test.ts - Brute-force cube detection, mesh properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dual-contouring";

type Vec3 = [number, number, number];
const CORNERS: Vec3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 300; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(300);
    return frames;
}

describe("Dual Contouring", () => {
    it("finds exactly the cubes whose corners straddle the iso value", () => {
        const dims: Vec3 = [5, 5, 5];
        const center: Vec3 = [2, 2, 2];
        const radius = 1.6;
        const frames = framesFor({ dims, center, radius, iso: 0 });
        const final = frames[frames.length - 1]!;
        const active = final.meta.activeCubes as number[];
        const value = (x: number, y: number, z: number) => radius - Math.hypot(x - center[0], y - center[1], z - center[2]);
        const [nx, ny, nz] = dims;
        const expected: number[] = [];
        for (let k = 0; k < nz - 1; k += 1) {
            for (let j = 0; j < ny - 1; j += 1) {
                for (let i = 0; i < nx - 1; i += 1) {
                    const signs = CORNERS.map((d) => value(i + d[0], j + d[1], k + d[2]) >= 0);
                    if (signs.some((s) => s) && signs.some((s) => !s)) {
                        expected.push((k * (ny - 1) + j) * (nx - 1) + i);
                    }
                }
            }
        }
        expect(active.length).toBe(expected.length);
        expect([...active].sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    });

    it("places vertices inside their cubes and links only face-adjacent cubes", () => {
        const frames = framesFor(mod.defaultInput);
        const final = frames[frames.length - 1]!;
        const active = final.meta.activeCubes as number[];
        const v3 = final.meta.vertices3D as number[];
        const dims = final.meta.dims as Vec3;
        const [nx, ny] = dims;
        expect(v3.length).toBe(active.length * 3);

        active.forEach((cube, index) => {
            const i = cube % (nx - 1);
            const j = Math.floor(cube / (nx - 1)) % (ny - 1);
            const k = Math.floor(cube / ((nx - 1) * (ny - 1)));
            expect(v3[index * 3]!).toBeGreaterThanOrEqual(i - 1e-9);
            expect(v3[index * 3]!).toBeLessThanOrEqual(i + 1 + 1e-9);
            expect(v3[index * 3 + 1]!).toBeGreaterThanOrEqual(j - 1e-9);
            expect(v3[index * 3 + 1]!).toBeLessThanOrEqual(j + 1 + 1e-9);
            expect(v3[index * 3 + 2]!).toBeGreaterThanOrEqual(k - 1e-9);
            expect(v3[index * 3 + 2]!).toBeLessThanOrEqual(k + 1 + 1e-9);
        });

        const edges = final.meta.dualEdges as number[];
        expect(edges.length % 2).toBe(0);
        for (let e = 0; e < edges.length; e += 2) {
            const a = edges[e]!;
            const b = edges[e + 1]!;
            expect(a).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThan(active.length);
            const ca = active[a]!;
            const cb = active[b]!;
            const dif = [
                Math.abs((ca % (nx - 1)) - (cb % (nx - 1))),
                Math.abs(Math.floor(ca / (nx - 1)) % (ny - 1) - Math.floor(cb / (nx - 1)) % (ny - 1)),
                Math.abs(Math.floor(ca / ((nx - 1) * (ny - 1))) - Math.floor(cb / ((nx - 1) * (ny - 1)))),
            ];
            expect(dif.filter((d) => d === 1).length).toBe(1);
            expect(dif.filter((d) => d === 0).length).toBe(2);
        }
        expect((final.meta.edgeCount as number)).toBeGreaterThan(0);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
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
