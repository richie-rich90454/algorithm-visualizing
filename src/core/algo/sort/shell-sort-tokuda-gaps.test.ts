/**
 * shell-sort-tokuda-gaps.test.ts - Correctness and frame checks for Tokuda Shell sort.
 */

import { describe, expect, it } from "vitest";
import module from "./shell-sort-tokuda-gaps";

function collect(input: unknown) {
    const frames = [];
    for (const frame of module.run(input)) {
        frames.push(frame);
        if (frames.length > 100000) {
            throw new Error("generator did not terminate");
        }
    }
    return frames;
}

function checkFrames(frames: ReturnType<typeof collect>): void {
    const lines = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("bar");
            expect(entity.id).toBeTruthy();
            expect(entity.state).toBeTruthy();
        }
    });
}

describe("shellSortTokudaGaps", () => {
    it("sorts by brute-force comparison on many inputs", () => {
        const cases: number[][] = [
            [],
            [1],
            [2, 1],
            [5, 5, 5, 5],
            [3, -1, 4, -1, 5, 9, 2, 6],
            [9, 8, 7, 6, 5, 4, 3, 2, 1],
        ];
        for (let trial = 0; trial < 20; trial += 1) {
            const size = (trial * 7) % 25;
            const values: number[] = [];
            for (let i = 0; i < size; i += 1) {
                values.push(((i * 37 + trial * 11) % 19) - 9);
            }
            cases.push(values);
        }
        for (const input of cases) {
            const frames = collect(input);
            const result = frames[frames.length - 1]!.entities.map((entity) => entity.value as number);
            expect(result).toEqual([...input].sort((a, b) => a - b));
        }
    });

    it("uses strictly decreasing gaps from the 2.25 recurrence", () => {
        for (const size of [2, 5, 12, 40, 2000]) {
            const generator = module.run(Array.from({ length: size }, (_, i) => size - i));
            const first = generator.next().value as unknown as { meta: { gaps: number[] } };
            const gaps = first.meta.gaps;
            expect(gaps[gaps.length - 1]).toBe(1);
            for (let i = 1; i < gaps.length; i += 1) {
                expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
            }
            const ascending = [...gaps].reverse();
            for (let i = 1; i < ascending.length; i += 1) {
                expect(ascending[i]).toBe(Math.floor(ascending[i - 1]! * 2.25) + 1);
            }
            for (const gap of gaps) {
                expect(gap).toBeLessThan(size);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = collect(module.defaultInput);
        expect(frames.length).toBeGreaterThan(1);
        checkFrames(frames);
    });
});
