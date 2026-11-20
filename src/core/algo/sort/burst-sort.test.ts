import { describe, expect, it } from "vitest";
import mod from "./burst-sort";

function finalFrame(strings: string[], capacity?: number) {
    const input = capacity === undefined ? { strings } : { strings, capacity };
    const all = [...mod.run(input)];
    return { all, final: all[all.length - 1]! };
}

describe("Burst Sort", () => {
    it("matches a brute-force sort across deterministic and random inputs", () => {
        const cases: string[][] = [
            [],
            ["solo"],
            ["b", "a", "c"],
            ["cat", "car", "dog", "cab", "bat", "dot", "can", "dove", "bad", "cow", "bar", "data", "dock", "bus"],
            ["aa", "aa", "aa", "ab", "ba"],
            ["", "a", "", "b"],
        ];
        let seed = 987654321;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const count = rand() % 20;
            const arr: string[] = [];
            for (let i = 0; i < count; i += 1) {
                const len = rand() % 5;
                let s = "";
                for (let k = 0; k < len; k += 1) {
                    s += "abc"[rand() % 3];
                }
                arr.push(s);
            }
            cases.push(arr);
        }
        for (const strings of cases) {
            const { final } = finalFrame(strings, 2);
            const sorted = final.meta["sorted"] as string[];
            expect(sorted).toEqual([...strings].sort());
            expect([...sorted].sort()).toEqual([...strings].sort());
        }
    });

    it("emits well-formed frames with sequential steps and in-range code lines", () => {
        const { all } = finalFrame(["cat", "car", "dog", "cab"]);
        expect(all.length).toBeGreaterThan(2);
        all.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("grid");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
            expect(typeof frame.meta["rows"]).toBe("number");
            expect(typeof frame.meta["cols"]).toBe("number");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("cell");
                expect(typeof entity.metadata["row"]).toBe("number");
                expect(typeof entity.metadata["col"]).toBe("number");
            }
        });
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of mod.run(mod.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(1000);
        }
        expect(count).toBeGreaterThan(0);
    });
});
