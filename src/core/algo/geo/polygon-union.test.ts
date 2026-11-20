/**
 * polygon-union.test.ts - Independent area cross-check via inclusion-exclusion,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./polygon-union";
import type { VisualFrame } from "@/types";

type Point = [number, number];

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

/** Independent Sutherland-Hodgman intersection area against a convex polygon. */
function intersectionArea(subject: Point[], clip: Point[]): number {
    let output = subject.slice();
    for (let i = 0; i < clip.length; i += 1) {
        const a = clip[i] as Point;
        const b = clip[(i + 1) % clip.length] as Point;
        const input = output;
        output = [];
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
    return twiceArea(output) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Polygon Union", () => {
    it("satisfies the inclusion-exclusion area identity", () => {
        const cases: Array<{ a: Point[]; b: Point[] }> = [
            {
                a: [[0, 0], [4, 0], [4, 4], [0, 4]],
                b: [[2, 2], [6, 2], [6, 6], [2, 6]],
            },
            {
                a: [[0, 0], [6, 0], [6, 5], [0, 5]],
                b: [[1, 1], [8, 1], [8, 4], [1, 4]],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            const expected = twiceArea(input.a) / 2 + twiceArea(input.b) / 2 - intersectionArea(input.a, input.b);
            expect(final.meta["area"]).toBeCloseTo(expected, 6);
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
