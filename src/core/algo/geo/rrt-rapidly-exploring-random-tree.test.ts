/** Correctness, frame shape, and termination checks for RRT. */
import { describe, expect, it } from "vitest";
import mod from "./rrt-rapidly-exploring-random-tree";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
type Circle = [number, number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function hitsCircle(a: Pt, b: Pt, c: Circle): boolean {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]) <= c[2];
}

describe("RRT Rapidly Exploring Random Tree", () => {
    it("builds a collision-free tree with short edges and a valid path", () => {
        const input = mod.defaultInput as {
            step: number;
            obstacles: Circle[];
            bounds: [number, number, number, number];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalFrame = frames[frames.length - 1]!;
        const final = finalFrame.meta;
        const points = finalFrame.entities.map((e) => [e.x, e.y] as Pt);
        expect(points.length).toBe(final["nodes"]);
        expect(finalFrame.edges.length).toBe(points.length - 1);
        for (const edge of finalFrame.edges) {
            const a = points[Number(edge.sourceId.slice(2))]!;
            const b = points[Number(edge.targetId.slice(2))]!;
            expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThanOrEqual(input.step + 1e-6);
            expect(input.obstacles.every((c) => !hitsCircle(a, b, c))).toBe(true);
            expect(b[0]).toBeGreaterThanOrEqual(input.bounds[0] - 1e-6);
            expect(b[1]).toBeGreaterThanOrEqual(input.bounds[1] - 1e-6);
            expect(b[0]).toBeLessThanOrEqual(input.bounds[2] + 1e-6);
            expect(b[1]).toBeLessThanOrEqual(input.bounds[3] + 1e-6);
        }
        const path = final["path"] as number[];
        if (final["found"]) {
            expect(path[0]).toBe(0);
            expect(path[path.length - 1]).toBe(points.length - 1);
            const connected = new Set(finalFrame.edges.map((e) => `${e.sourceId}->${e.targetId}`));
            for (let i = 1; i < path.length; i += 1) {
                expect(connected.has(`n-${path[i - 1]}->n-${path[i]}`)).toBe(true);
            }
        }
    });

    it("is deterministic for a fixed seed", () => {
        const first = [...mod.run(mod.defaultInput)];
        const second = [...mod.run(mod.defaultInput)];
        expect(first[first.length - 1]?.meta).toEqual(second[second.length - 1]?.meta);
    });

    it("handles an empty obstacle set", () => {
        const frames = [...mod.run({ iterations: 80, obstacles: [] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["nodes"]).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
