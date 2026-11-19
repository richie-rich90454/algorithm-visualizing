/** bug-algorithm-navigation.test.ts - Collision and reachability properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./bug-algorithm-navigation";

type Pt = [number, number];
interface Disk {
    center: Pt;
    radius: number;
}

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

function pathFrom(final: ReturnType<typeof framesFor>[number]): Pt[] {
    const flat = final.meta.path as number[];
    const path: Pt[] = [];
    for (let i = 0; i < flat.length; i += 2) path.push([flat[i]!, flat[i + 1]!]);
    return path;
}

describe("Bug Algorithm Navigation", () => {
    it("keeps the path outside obstacles and reaches the goal", () => {
        const obstacles: Disk[] = [{ center: [5, 0.6], radius: 1.2 }];
        const frames = framesFor({ start: [0, 0], goal: [10, 0], obstacles, step: 0.35, maxSteps: 200 });
        const final = frames[frames.length - 1]!;
        const path = pathFrom(final);

        expect(final.meta.reached).toBe(true);
        expect((final.meta.hits as number)).toBeGreaterThanOrEqual(1);
        expect(path[0]![0]).toBeCloseTo(0, 9);
        expect(path[0]![1]).toBeCloseTo(0, 9);
        const last = path[path.length - 1]!;
        expect(Math.hypot(last[0] - 10, last[1])).toBeLessThanOrEqual(0.35 + 1e-9);

        for (const p of path) {
            expect(Number.isFinite(p[0])).toBe(true);
            expect(Number.isFinite(p[1])).toBe(true);
            for (const disk of obstacles) {
                expect(Math.hypot(p[0] - disk.center[0], p[1] - disk.center[1])).toBeGreaterThanOrEqual(disk.radius - 1e-6);
            }
        }
        for (let i = 1; i < path.length; i += 1) {
            const step = Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
            expect(step).toBeLessThanOrEqual(0.35 * 1.2 + 0.1);
        }
    });

    it("walks a straight line when no obstacles exist", () => {
        const frames = framesFor({ start: [0, 0], goal: [5, 0], obstacles: [], step: 0.5, maxSteps: 50 });
        const final = frames[frames.length - 1]!;
        const path = pathFrom(final);
        expect(final.meta.reached).toBe(true);
        expect((final.meta.hits as number)).toBe(0);
        expect(path.length).toBe(10);
        for (const p of path) expect(p[1]).toBeCloseTo(0, 9);
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
