/** Correctness, frame shape, and termination checks for the power diagram. */
import { describe, expect, it } from "vitest";
import mod from "./power-diagram";
import type { VisualFrame } from "@/types";

type Site = [number, number, number];
type P2 = [number, number];

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

function power(p: P2, s: Site): number {
    return (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 - s[2];
}

function insideConvex(point: P2, poly: P2[]): boolean {
    if (poly.length < 3) return false;
    let positive = 0;
    let negative = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const p = poly[i]!;
        const q = poly[(i + 1) % poly.length]!;
        const cross = (q[0] - p[0]) * (point[1] - p[1]) - (q[1] - p[1]) * (point[0] - p[0]);
        if (cross > 1e-6) positive += 1;
        if (cross < -1e-6) negative += 1;
    }
    return positive === 0 || negative === 0;
}

describe("Power Diagram", () => {
    it("assigns sample points to the cell of the minimum-power site", () => {
        const input = mod.defaultInput as { sites: Site[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const cells = (final?.["cells"] as string[]).map((encoded) =>
            encoded
                .split(";")
                .filter((part) => part.length > 0)
                .map((part) => part.split(",").map(Number) as P2),
        );
        expect(cells.length).toBe(input.sites.length);
        const xs = input.sites.map((s) => s[0]);
        const ys = input.sites.map((s) => s[1]);
        const minX = Math.min(...xs) - 2;
        const maxX = Math.max(...xs) + 2;
        const minY = Math.min(...ys) - 2;
        const maxY = Math.max(...ys) + 2;
        let checks = 0;
        for (let x = minX; x <= maxX; x += 0.7) {
            for (let y = minY; y <= maxY; y += 0.7) {
                const p: P2 = [x, y];
                let winner = 0;
                for (let i = 1; i < input.sites.length; i += 1) {
                    if (power(p, input.sites[i]!) < power(p, input.sites[winner]!)) winner = i;
                }
                expect(insideConvex(p, cells[winner]!)).toBe(true);
                checks += 1;
            }
        }
        expect(checks).toBeGreaterThan(20);
    });

    it("keeps weights meaningful: a heavier site gains area", () => {
        const light = [...mod.run({ sites: [[0, 0, 0], [4, 0, 0]] })];
        checkFrames(light);
        const heavy = [...mod.run({ sites: [[0, 0, 0], [4, 0, 6]] })];
        checkFrames(heavy);
        const polygonArea = (poly: P2[]): number => {
            let a = 0;
            for (let i = 0; i < poly.length; i += 1) {
                const p = poly[i]!;
                const q = poly[(i + 1) % poly.length]!;
                a += p[0] * q[1] - q[0] * p[1];
            }
            return Math.abs(a) / 2;
        };
        const parseFirst = (frame: VisualFrame): P2[] =>
            (frame.meta["cells"] as string[])[0]!
                .split(";")
                .filter((part) => part.length > 0)
                .map((part) => part.split(",").map(Number) as P2);
        const firstLight = parseFirst(light[light.length - 1]!);
        const firstHeavy = parseFirst(heavy[heavy.length - 1]!);
        expect(polygonArea(firstHeavy)).toBeLessThan(polygonArea(firstLight));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
