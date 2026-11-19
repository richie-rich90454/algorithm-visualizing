import { describe, expect, it } from "vitest";
import floydRivest from "./floyd-rivest-select";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("FloydRivestSelect", () => {
    it("yields well-formed array frames and terminates", () => {
        let index = 0;
        for (const frame of floydRivest.run(floydRivest.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(floydRivest.pseudocode!.length);
            expect(frame.layout).toBe("array");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(VALID.has(entity.state)).toBe(true);
            }
            index += 1;
        }
        expect(index).toBeGreaterThan(0);
    });

    it("returns the exact kth order statistic on random arrays", () => {
        let seed = 53;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const len = 9 + (rand() % 40);
            const arr = Array.from({ length: len }, () => rand() % 100);
            const k = rand() % len;
            let last = null;
            for (const frame of floydRivest.run({ array: arr, k })) last = frame;
            expect(last).not.toBeNull();
            expect(last!.meta.result).toBe([...arr].sort((a, b) => a - b)[k]);
        }
    });
});
