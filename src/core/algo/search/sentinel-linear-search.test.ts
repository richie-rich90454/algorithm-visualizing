import { describe, expect, it } from "vitest";
import sentinel from "./sentinel-linear-search";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("SentinelLinearSearch", () => {
    it("yields well-formed array frames and terminates", () => {
        let index = 0;
        for (const frame of sentinel.run(sentinel.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(sentinel.pseudocode!.length);
            expect(frame.layout).toBe("array");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(VALID.has(entity.state)).toBe(true);
            }
            index += 1;
        }
        expect(index).toBeGreaterThan(0);
    });

    it("reports the same index as Array.indexOf on random inputs", () => {
        let seed = 67;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const len = rand() % 15;
            const arr = Array.from({ length: len }, () => rand() % 10);
            const target = rand() % 12;
            let last = null;
            for (const frame of sentinel.run({ array: arr, target })) last = frame;
            expect(last).not.toBeNull();
            expect(last!.meta.foundIndex).toBe(arr.indexOf(target));
        }
    });
});
