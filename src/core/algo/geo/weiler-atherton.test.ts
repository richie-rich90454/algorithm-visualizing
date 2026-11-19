/** weiler-atherton.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./weiler-atherton";
import type { VisualFrame } from "@/types";

type Pt = [number, number];

/** Independent Sutherland-Hodgman clip against a convex clip polygon. */
function referenceClip(subject: Pt[], clipPoly: Pt[]): Pt[] {
    let output = subject.slice();
    for (let i = 0; i < clipPoly.length && output.length > 0; i += 1) {
        const a = clipPoly[i] as Pt;
        const b = clipPoly[(i + 1) % clipPoly.length] as Pt;
        const input = output;
        output = [];
        const inside = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
        const intersect = (p: Pt, q: Pt): Pt => {
            const dx = q[0] - p[0];
            const dy = q[1] - p[1];
            const den = (b[0] - a[0]) * dy - (b[1] - a[1]) * dx;
            if (Math.abs(den) < 1e-12) {
                return p;
            }
            const t = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / -den;
            return [p[0] + t * dx, p[1] + t * dy];
        };
        for (let k = 0; k < input.length; k += 1) {
            const cur = input[k] as Pt;
            const prev = input[(k + input.length - 1) % input.length] as Pt;
            const curIn = inside(cur);
            const prevIn = inside(prev);
            if (curIn) {
                if (!prevIn) output.push(intersect(prev, cur));
                output.push(cur);
            } else if (prevIn) {
                output.push(intersect(prev, cur));
            }
        }
    }
    return output;
}

function area(poly: Pt[]): number {
    if (poly.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Pt;
        const b = poly[(i + 1) % poly.length] as Pt;
        s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const pc = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
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

describe("Weiler-Atherton polygon clipping", () => {
    it("clips the default overlapping squares to the correct area", () => {
        const input = mod.defaultInput as { subject: Pt[]; clip: Pt[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["crossings"])).toBe(2);
        expect(Number(finalMeta?.["area"])).toBeCloseTo(area(referenceClip(input.subject, input.clip)), 5);
        expect(Number(finalMeta?.["area"])).toBeCloseTo(9, 5);
    });

    it("matches Sutherland-Hodgman on several convex overlaps", () => {
        const cases: Array<{ subject: Pt[]; clip: Pt[] }> = [
            {
                subject: [[0, 0], [4, 0], [4, 4], [0, 4]],
                clip: [[2, 2], [6, 2], [6, 6], [2, 6]],
            },
            {
                subject: [[0, 0], [10, 0], [10, 6], [0, 6]],
                clip: [[1, 1], [5, 1], [5, 3], [1, 3]],
            },
            {
                subject: [[0, 0], [8, 0], [8, 8], [0, 8]],
                clip: [[2, 2], [6, 2], [6, 6], [2, 6]],
            },
            {
                subject: [[0, 0], [3, 0], [3, 3], [0, 3]],
                clip: [[10, 10], [12, 10], [12, 12], [10, 12]],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const reported = Number(frames[frames.length - 1]?.meta["area"]);
            const expected = area(referenceClip(testCase.subject, testCase.clip));
            expect(reported).toBeCloseTo(expected, 5);
        }
    });

    it("handles containment without crossings", () => {
        const frames = [...mod.run({
            subject: [[2, 2], [4, 2], [4, 4], [2, 4]],
            clip: [[0, 0], [6, 0], [6, 6], [0, 6]],
        })];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["crossings"])).toBe(0);
        expect(Number(finalMeta?.["area"])).toBeCloseTo(4, 5);
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
