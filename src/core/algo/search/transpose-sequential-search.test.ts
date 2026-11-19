import { describe, expect, it } from "vitest";
import module from "./transpose-sequential-search";

function framesFor(items: number[], queries: number[]) {
    return [...module.run({ items, queries })];
}

function reference(items: number[], queries: number[]) {
    const list = [...items];
    const verdicts: boolean[] = [];
    let transposes = 0;
    for (const q of queries) {
        const at = list.indexOf(q);
        verdicts.push(at >= 0);
        if (at > 0) {
            const t = list[at - 1] as number;
            list[at - 1] = list[at] as number;
            list[at] = t;
            transposes += 1;
        }
    }
    return { list, verdicts, transposes };
}

describe("transpose-sequential-search", () => {
    it("matches a reference transpose heuristic on random streams (property check)", () => {
        let seed = 515151;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 100; t += 1) {
            const m = 1 + (rand() % 8);
            const items = Array.from({ length: m }, () => rand() % 6);
            const queries = Array.from({ length: 6 }, () => rand() % 7);
            const expected = reference(items, queries);
            const frames = framesFor(items, queries);
            const byQuery = new Map<number, boolean>();
            for (const f of frames) {
                if (f.codeLineNumber === 5 && typeof f.meta.queryIndex === "number" && f.meta.queryIndex < queries.length) {
                    byQuery.set(f.meta.queryIndex, f.meta.found as boolean);
                }
            }
            for (let q = 0; q < queries.length; q += 1) {
                expect(byQuery.get(q)).toBe(expected.verdicts[q]);
            }
            const last = frames[frames.length - 1]!;
            expect(last.entities.map((e) => e.value as number)).toEqual(expected.list);
            expect(last.meta.transposes).toBe(expected.transposes);
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = framesFor([5, 3, 8, 1, 9], [8, 8, 1, 5, 2]);
        expect(frames.length).toBeGreaterThan(4);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges).toEqual([]);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toHaveProperty("comparisons");
            expect(frame.meta).toHaveProperty("transposes");
        });
        expect(frames[frames.length - 1]!.meta.transposes).toBe(4);
    });
});
