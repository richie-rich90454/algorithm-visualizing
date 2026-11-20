/**
 * ellipsoid-method.test.ts - Reference cut recurrence, volume shrinkage,
 * feasible-region containment, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ellipsoid-method";
import type { VisualFrame } from "@/types";

interface Constraint {
    a: [number, number];
    b: number;
}
interface E {
    cx: number;
    cy: number;
    q00: number;
    q01: number;
    q11: number;
}

function det(e: E): number {
    return e.q00 * e.q11 - e.q01 * e.q01;
}

function cut(e: E, a: [number, number]): E {
    const qa0 = e.q00 * a[0] + e.q01 * a[1];
    const qa1 = e.q01 * a[0] + e.q11 * a[1];
    const tau = a[0] * qa0 + a[1] * qa1;
    const scale = Math.sqrt(Math.max(tau, 1e-18));
    const p0 = qa0 / scale;
    const p1 = qa1 / scale;
    return {
        cx: e.cx - p0 / 3,
        cy: e.cy - p1 / 3,
        q00: (4 / 3) * (e.q00 - (2 / 3) * p0 * p0),
        q01: (4 / 3) * (e.q01 - (2 / 3) * p0 * p1),
        q11: (4 / 3) * (e.q11 - (2 / 3) * p1 * p1),
    };
}

function violated(constraints: Constraint[], e: E): Constraint | null {
    return constraints.find((c) => c.a[0] * e.cx + c.a[1] * e.cy > c.b + 1e-9) ?? null;
}

function vertices(constraints: Constraint[]): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    for (let i = 0; i < constraints.length; i += 1) {
        for (let j = i + 1; j < constraints.length; j += 1) {
            const l = constraints[i]!;
            const r = constraints[j]!;
            const d = l.a[0] * r.a[1] - l.a[1] * r.a[0];
            if (Math.abs(d) < 1e-12) continue;
            const x = (l.b * r.a[1] - r.b * l.a[1]) / d;
            const y = (l.a[0] * r.b - r.a[0] * l.b) / d;
            if (constraints.every((c) => c.a[0] * x + c.a[1] * y <= c.b + 1e-9)) points.push([x, y]);
        }
    }
    return points;
}

/** Reconstruct the shape matrix from the ellipse axes and angle in frame meta. */
function fromMeta(frame: VisualFrame): E {
    const a2 = Number(frame.meta["axisA"]) ** 2;
    const b2 = Number(frame.meta["axisB"]) ** 2;
    const angle = Number(frame.meta["angle"]);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        cx: Number(frame.meta["cx"]),
        cy: Number(frame.meta["cy"]),
        q00: a2 * c * c + b2 * s * s,
        q01: (a2 - b2) * c * s,
        q11: a2 * s * s + b2 * c * c,
    };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThanOrEqual(1);
        expect(frame.entities.length).toBeLessThanOrEqual(n + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ellipsoid method", () => {
    const input = mod.defaultInput as { constraints: Constraint[]; radius: number; iterations: number };

    it("matches a reference sequence of cuts", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, vertices(input.constraints).length);
        let reference: E = {
            cx: 0,
            cy: 0,
            q00: input.radius ** 2,
            q01: 0,
            q11: input.radius ** 2,
        };
        const expected = [det(reference)];
        for (let i = 0; i < input.iterations; i += 1) {
            const bad = violated(input.constraints, reference);
            if (!bad) break;
            reference = cut(reference, bad.a);
            expected.push(det(reference));
        }
        for (const frame of frames) {
            const d = Number(frame.meta["determinant"]);
            const match = expected.findIndex((value) => Math.abs(value - d) < Math.max(1e-6, Math.abs(value) * 1e-9));
            expect(match).toBeGreaterThanOrEqual(0);
        }
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["determinant"])).toBeCloseTo(det(reference), 6);
        expect(Number(final["cx"])).toBeCloseTo(reference.cx, 6);
        expect(Number(final["cy"])).toBeCloseTo(reference.cy, 6);
    });

    it("shrinks volume by exactly 16/27 on every cut", () => {
        const frames = [...mod.run(input)];
        let previous = Number(frames[0]?.meta["determinant"]);
        let cuts = 0;
        for (const frame of frames) {
            const current = Number(frame.meta["determinant"]);
            if (current < previous - 1e-9) {
                expect(current / previous).toBeCloseTo(16 / 27, 9);
                cuts += 1;
            }
            previous = current;
        }
        expect(cuts).toBeGreaterThan(0);
    });

    it("keeps every feasible vertex inside the ellipsoid at every frame", () => {
        const points = vertices(input.constraints);
        expect(points.length).toBeGreaterThanOrEqual(3);
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const e = fromMeta(frame);
            const d = det(e);
            expect(d).toBeGreaterThan(0);
            for (const [x, y] of points) {
                const dx = x - e.cx;
                const dy = y - e.cy;
                const form = (dx * dx * e.q11 - 2 * dx * dy * e.q01 + dy * dy * e.q00) / d;
                expect(form).toBeLessThanOrEqual(1 + 1e-5);
            }
        }
    });

    it("terminates with a feasible center", () => {
        const generator = mod.run(input);
        const frames = [...generator];
        expect(frames[frames.length - 1]?.meta["feasible"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
