import { describe, expect, it } from "vitest";
import squaresort from "./squaresort";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("SquareSort", () => {
    it("yields well-formed array frames and terminates", () => {
        let index = 0;
        let frames = 0;
        for (const frame of squaresort.run(squaresort.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(squaresort.pseudocode!.length);
            expect(frame.layout).toBe("array");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(VALID.has(entity.state)).toBe(true);
            }
            index += 1;
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });

    it("sorts random arrays and preserves the multiset", () => {
        let seed = 43;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const len = rand() % 13;
            const arr = Array.from({ length: len }, () => (rand() % 17) - 8);
            let last = null;
            for (const frame of squaresort.run([...arr])) last = frame;
            expect(last).not.toBeNull();
            const out = last!.entities.map((e) => e.value) as number[];
            expect(out).toEqual([...arr].sort((a, b) => a - b));
            expect([...out].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});
