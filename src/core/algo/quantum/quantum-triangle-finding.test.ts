/**
 * quantum-triangle-finding.test.ts - Triangle finding correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-triangle-finding";
import type { VisualFrame } from "@/types";

type Edge = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent brute-force triangle count over all vertex triples. */
function bruteTriangles(n: number, edges: Edge[]): number {
    const has = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    let count = 0;
    for (let a = 0; a < n; a += 1) {
        for (let b = a + 1; b < n; b += 1) {
            for (let c = b + 1; c < n; c += 1) {
                if (has.has(`${a}-${b}`) && has.has(`${a}-${c}`) && has.has(`${b}-${c}`)) {
                    count += 1;
                }
            }
        }
    }
    return count;
}

describe("Quantum Triangle Finding", () => {
    it("returns a real triangle and matches the brute-force count", () => {
        const input = mod.defaultInput as { vertices: number; edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const triangle = final?.["triangle"] as number[];
        expect(final?.["found"]).toBe(true);
        expect(new Set(triangle).size).toBe(3);
        const has = new Set(input.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
        expect(has.has(`${triangle[0]}-${triangle[1]}`)).toBe(true);
        expect(has.has(`${triangle[0]}-${triangle[2]}`)).toBe(true);
        expect(has.has(`${triangle[1]}-${triangle[2]}`)).toBe(true);
        expect(Number(final?.["marked"])).toBe(bruteTriangles(input.vertices, input.edges));
    });

    it("reports triangle-free graphs correctly", () => {
        const frames = [...mod.run({ vertices: 4, edges: [[0, 1], [1, 2], [2, 3]] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["found"]).toBe(false);
        expect(bruteTriangles(4, [[0, 1], [1, 2], [2, 3]])).toBe(0);
    });

    it("finds triangles on a complete graph", () => {
        const input = mod.defaultInput as { vertices: number; edges: Edge[] };
        const frames = [...mod.run(input)];
        expect(Number(frames[frames.length - 1]?.meta["marked"])).toBe(bruteTriangles(input.vertices, input.edges));
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
