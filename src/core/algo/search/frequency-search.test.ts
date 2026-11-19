import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./frequency-search";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

function expectedOrder(items: number[]): number[] {
    const distinct: number[] = [];
    for (const value of items) if (!distinct.includes(value)) distinct.push(value);
    const first = new Map<number, number>();
    for (const value of distinct) first.set(value, items.indexOf(value));
    distinct.sort((a, b) => {
        const countA = items.filter((x) => x === a).length;
        const countB = items.filter((x) => x === b).length;
        return countB - countA || (first.get(a) as number) - (first.get(b) as number);
    });
    const out: number[] = [];
    for (const value of distinct) {
        for (let i = 0; i < items.filter((x) => x === value).length; i += 1) out.push(value);
    }
    return out;
}

describe("Frequency-Ordered Search", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("matches a brute-force frequency order and search on the default input", () => {
        const { items, query } = mod.defaultInput as { items: number[]; query: number };
        const frames = collect({ items, query });
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.entities.map((e) => Number(e.label))).toEqual(expectedOrder(items));
        expect(Boolean(last.meta.found)).toBe(items.includes(query));
        expect(Number(last.meta.position)).toBe(expectedOrder(items).indexOf(query));
        expect(Number(last.meta.comparisons)).toBe(expectedOrder(items).indexOf(query) + 1);
    });

    it("matches brute force across random lists and queries", () => {
        let seed = 998877;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 150; trial += 1) {
            const n = 1 + (next() % 15);
            const items = Array.from({ length: n }, () => next() % 6);
            const query = next() % 8;
            const frames = collect({ items, query });
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            const order = expectedOrder(items);
            expect(last.entities.map((e) => Number(e.label))).toEqual(order);
            expect(Boolean(last.meta.found)).toBe(items.includes(query));
            const expectedPosition = order.indexOf(query);
            expect(Number(last.meta.position)).toBe(expectedPosition);
            expect(Number(last.meta.comparisons)).toBe(
                expectedPosition === -1 ? items.length : expectedPosition + 1,
            );
        }
    });

    it("handles an empty list", () => {
        const frames = collect({ items: [], query: 3 });
        expect(Number((frames[frames.length - 1] as VisualFrame).meta.position)).toBe(-1);
    });
});
