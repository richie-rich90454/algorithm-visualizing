/**
 * hypergraph-coloring.test.ts - Brute-force minimum coloring check, frame
 * shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hypergraph-coloring";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function isProper(vertices: string[], hyperedges: string[][], k: number): boolean {
    const assign = new Map<string, number>();
    const search = (index: number): boolean => {
        if (index >= vertices.length) {
            return true;
        }
        const v = vertices[index];
        if (v === undefined) {
            return false;
        }
        for (let color = 0; color < k; color += 1) {
            assign.set(v, color);
            let ok = true;
            for (const edge of hyperedges) {
                if (edge.includes(v) && edge.every((u) => assign.has(u))) {
                    const first = assign.get(edge[0] ?? "");
                    if (edge.every((u) => assign.get(u) === first)) {
                        ok = false;
                        break;
                    }
                }
            }
            if (ok && search(index + 1)) {
                return true;
            }
            assign.delete(v);
        }
        return false;
    };
    return search(0);
}

function bruteForce(vertices: string[], hyperedges: string[][]): number {
    for (let k = 2; k <= vertices.length; k += 1) {
        if (isProper(vertices, hyperedges, k)) {
            return k;
        }
    }
    return 0;
}

describe("Hypergraph Coloring", () => {
    it("matches brute force on several hypergraphs", () => {
        const cases: Array<{ vertices: string[]; hyperedges: string[][] }> = [
            { vertices: ["A", "B", "C", "D", "E"], hyperedges: [["A", "B", "C"], ["B", "C", "D"], ["C", "D", "E"], ["A", "E"]] },
            { vertices: ["A", "B", "C"], hyperedges: [["A", "B", "C"]] },
            { vertices: ["A", "B", "C", "D"], hyperedges: [["A", "B"], ["C", "D"]] },
            { vertices: ["A", "B", "C", "D"], hyperedges: [["A", "B", "C"], ["A", "B", "D"], ["A", "C", "D"], ["B", "C", "D"]] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["chromaticNumber"]).toBe(bruteForce(testCase.vertices, testCase.hyperedges));
            const coloring = new Map(
                (meta?.["coloring"] as string[]).map((entry) => {
                    const [v, c] = entry.split(":");
                    return [v ?? "", Number(c)] as const;
                }),
            );
            for (const edge of testCase.hyperedges) {
                expect(new Set(edge.map((v) => coloring.get(v))).size).toBeGreaterThan(1);
            }
        }
    });

    it("reports no coloring for a singleton hyperedge input", () => {
        const frames = [...mod.run({ vertices: ["A", "B"], hyperedges: [["A"]] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["chromaticNumber"]).toBe(0);
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
