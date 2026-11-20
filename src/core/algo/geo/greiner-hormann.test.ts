/**
 * greiner-hormann.test.ts - Independent Sutherland-Hodgman area cross-check,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./greiner-hormann";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Twice the signed area of a polygon. */
function twiceArea(poly: Point[]): number {
    if (poly.length < 3) {
        return 0;
    }
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Point;
        const b = poly[(i + 1) % poly.length] as Point;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum);
}

/** Independent Sutherland-Hodgman clip against a convex CCW clip polygon. */
function referenceClip(subject: Point[], clip: Point[]): Point[] {
    let output = subject.slice();
    for (let i = 0; i < clip.length; i += 1) {
        const a = clip[i] as Point;
        const b = clip[(i + 1) % clip.length] as Point;
        const input = output;
        output = [];
        if (input.length === 0) {
            break;
        }
        const side = (p: Point): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        for (let j = 0; j < input.length; j += 1) {
            const cur = input[j] as Point;
            const prev = input[(j + input.length - 1) % input.length] as Point;
            const curIn = side(cur) >= -1e-9;
            const prevIn = side(prev) >= -1e-9;
            if (curIn !== prevIn) {
                const s = side(prev);
                const e = side(cur);
                const t = s / (s - e);
                output.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
            }
            if (curIn) {
                output.push(cur);
            }
        }
    }
    return output;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Greiner-Hormann Polygon Clipping", () => {
    it("matches an independent Sutherland-Hodgman intersection area", () => {
        const cases: Array<{ subject: Point[]; clip: Point[] }> = [
            {
                subject: [[0, 0], [4, 0], [4, 4], [0, 4]],
                clip: [[2, 2], [6, 2], [6, 6], [2, 6]],
            },
            {
                subject: [[0, 0], [6, 0], [6, 5], [0, 5]],
                clip: [[1, 1], [8, 1], [8, 4], [1, 4]],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            const output = JSON.parse(final.meta["output"] as string) as Point[];
            expect(Array.isArray(output)).toBe(true);
            expect(output.length).toBeGreaterThanOrEqual(3);
            expect(twiceArea(output)).toBeCloseTo(twiceArea(referenceClip(input.subject, input.clip)), 6);
        }
    });

    it("reports an empty intersection for disjoint polygons", () => {
        const input = {
            subject: [[0, 0], [2, 0], [2, 2], [0, 2]] as Point[],
            clip: [[5, 5], [7, 5], [7, 7], [5, 7]] as Point[],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["outputVertices"]).toBe(0);
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
