import { describe, expect, it } from "vitest";
import mod, { createScalableBloom, scalableInsert, scalableLookup } from "./scalable-bloom-filter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("Scalable Bloom Filter", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["allPresent"]).toBe(true);
        expect(Number(last?.meta["layers"])).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });

    it("never reports a false negative and keeps false positives low", () => {
        let seed = 555000;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        let totalFalsePositives = 0;
        let totalProbes = 0;
        for (let trial = 0; trial < 30; trial += 1) {
            const filter = createScalableBloom(3, 2, 0.5, 3, 16);
            const inserted: number[] = [];
            for (let i = 0; i < 20; i += 1) {
                const key = 1 + rand(100000);
                if (!inserted.includes(key)) {
                    inserted.push(key);
                    scalableInsert(filter, key);
                }
            }
            for (const key of inserted) {
                expect(scalableLookup(filter, key)).toBe(true);
            }
            expect(filter.layers.length).toBeGreaterThan(1);
            for (let probe = 0; probe < 30; probe += 1) {
                const absent = 200000 + rand(100000);
                if (inserted.includes(absent)) {
                    continue;
                }
                totalProbes += 1;
                if (scalableLookup(filter, absent)) {
                    totalFalsePositives += 1;
                }
            }
        }
        expect(totalFalsePositives / totalProbes).toBeLessThan(0.15);
    });

    it("grows a new layer exactly when capacity is exceeded", () => {
        const filter = createScalableBloom(2, 2, 0.5, 3, 16);
        expect(scalableInsert(filter, 1)).toBe(0);
        expect(scalableInsert(filter, 2)).toBe(0);
        expect(scalableInsert(filter, 3)).toBe(1);
        expect(scalableInsert(filter, 4)).toBe(1);
        expect(scalableInsert(filter, 5)).toBe(1);
        expect(scalableInsert(filter, 6)).toBe(1);
        expect(scalableInsert(filter, 7)).toBe(2);
        expect(filter.layers.length).toBe(3);
        expect(filter.layers[1]?.capacity).toBe(4);
        expect(filter.layers[2]?.capacity).toBe(8);
    });
});
