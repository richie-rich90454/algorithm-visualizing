/** havel-hakimi.test.ts - Brute-force realizability check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import havelHakimi from "./havel-hakimi";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(havelHakimi.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.meta).toBeTypeOf("object");
        frame.edges.forEach((edge) => {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

/** Enumerate every simple graph on n vertices and test its degree multiset. */
function bruteRealizable(degrees: number[]): boolean {
    const n = degrees.length;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            pairs.push([i, j]);
        }
    }
    const wanted = [...degrees].sort((a, b) => a - b).join(",");
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
        const current = Array(n).fill(0) as number[];
        for (let p = 0; p < pairs.length; p += 1) {
            if ((mask >> p) & 1) {
                const [u, v] = pairs[p] as [number, number];
                current[u] = (current[u] as number) + 1;
                current[v] = (current[v] as number) + 1;
            }
        }
        if ([...current].sort((a, b) => a - b).join(",") === wanted) {
            return true;
        }
    }
    return false;
}

describe("Havel-Hakimi", () => {
    it("matches brute-force realizability and builds valid degrees", () => {
        const cases = [
            [3, 3, 2, 2, 2, 2],
            [2, 2, 2, 2],
            [3, 1, 1],
            [1, 1, 1, 1],
            [4, 4, 4, 4, 4],
            [2, 2, 2],
            [0, 0, 0],
            [5, 1, 1, 1, 1, 1],
        ];
        for (const degrees of cases) {
            if (degrees.length > 6) {
                continue;
            }
            const frames = sumAll(havelHakimi.run({ degrees: [...degrees] }));
            const final = frames[frames.length - 1];
            const expected = bruteRealizable(degrees);
            expect(final?.meta["realizable"]).toBe(expected ? "yes" : "no");
            if (expected) {
                const built = Array(degrees.length).fill(0) as number[];
                for (const edge of final?.edges ?? []) {
                    const u = Number(edge.sourceId.slice(5));
                    const v = Number(edge.targetId.slice(5));
                    built[u] = (built[u] as number) + 1;
                    built[v] = (built[v] as number) + 1;
                }
                expect([...built].sort((a, b) => a - b)).toEqual([...degrees].sort((a, b) => a - b));
            }
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(havelHakimi.run(havelHakimi.defaultInput)));
        const generator = havelHakimi.run(havelHakimi.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
