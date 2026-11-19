import { describe, expect, it } from "vitest";
import mod, { buildZdd, zddContains, zddCount } from "./zero-suppressed-decision-diagram";
import type { VisualFrame } from "@/types";

/** Brute-force membership by enumerating the original family as sorted strings. */
function referenceFamily(universe: number, sets: number[][]): Set<string> {
    const result = new Set<string>();
    for (const set of sets) {
        const members = [...new Set(set.filter((v) => v >= 0 && v < universe))].sort((a, b) => a - b);
        result.add(members.join(","));
    }
    return result;
}

function maskToKey(mask: number): string {
    const members: number[] = [];
    for (let i = 0; i < 12; i += 1) {
        if ((mask & (1 << i)) !== 0) {
            members.push(i);
        }
    }
    return members.join(",");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.edges.every((edge) => edge.sourceId.startsWith("z-") && edge.targetId.startsWith("z-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 9);
        expect(frame.meta).toBeDefined();
    });
}

describe("Zero-Suppressed Decision Diagram", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["sameCount"]).toBe(true);
        expect(last?.meta["count"]).toBe(5);
        expect(generator.next().done).toBe(true);
    });

    it("counts and classifies every subset exactly like brute force", () => {
        let seed = 20261119;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const universe = 1 + rand(5);
            const setCount = rand(12);
            const sets: number[][] = [];
            for (let i = 0; i < setCount; i += 1) {
                const subset: number[] = [];
                for (let v = 0; v < universe; v += 1) {
                    if (rand(3) === 0) {
                        subset.push(v);
                    }
                }
                sets.push(subset);
            }
            const family = referenceFamily(universe, sets);
            const zdd = buildZdd(universe, sets);
            expect(zddCount(zdd)).toBe(family.size);
            for (let mask = 0; mask < 1 << universe; mask += 1) {
                expect(zddContains(zdd, mask)).toBe(family.has(maskToKey(mask)));
            }
        }
    });

    it("handles the empty family and the family containing only the empty set", () => {
        const empty = buildZdd(3, []);
        expect(zddCount(empty)).toBe(0);
        expect(zddContains(empty, 0)).toBe(false);
        const one = buildZdd(3, [[]]);
        expect(zddCount(one)).toBe(1);
        expect(zddContains(one, 0)).toBe(true);
        expect(zddContains(one, 1)).toBe(false);
    });
});
