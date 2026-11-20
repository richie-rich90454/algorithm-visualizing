import { describe, expect, it } from "vitest";
import mod from "./interval-dp";

/** Independent brute force: enumerate every binary merge order (no memoization). */
function bruteForce(stones: number[], lo: number, hi: number): number {
    if (lo >= hi) {
        return 0;
    }
    let total = 0;
    for (let i = lo; i <= hi; i += 1) {
        total += stones[i] ?? 0;
    }
    let best = Infinity;
    for (let k = lo; k < hi; k += 1) {
        const cost = bruteForce(stones, lo, k) + bruteForce(stones, k + 1, hi) + total;
        if (cost < best) {
            best = cost;
        }
    }
    return best;
}

function framesFor(stones: number[]) {
    return [...mod.run({ stones })];
}

describe("IntervalDp (merge stones)", () => {
    it("matches brute-force minimum merge cost on several inputs", () => {
        const cases: number[][] = [
            [],
            [5],
            [1, 2],
            [4, 3, 3, 4],
            [2, 2, 2, 2],
            [1, 2, 3, 4],
            [8, 6, 4, 2, 1],
        ];
        for (const stones of cases) {
            const frames = framesFor(stones);
            const last = frames[frames.length - 1];
            expect(last?.meta.answer, `stones ${stones.join(",")}`).toBe(
                stones.length <= 1 ? 0 : bruteForce(stones, 0, stones.length - 1),
            );
            // The module's own independent cross-check must agree when present.
            if (stones.length >= 2) {
                expect(last?.meta.bruteForce).toBe(last?.meta.answer);
            }
        }
    });

    it("emits well-formed grid frames with sequential step numbers", () => {
        const frames = framesFor([4, 3, 3, 4]);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("grid");
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect((mod.pseudocode ?? []).length).toBeGreaterThan(frame.codeLineNumber ?? 0);
            expect(frame.meta.rows).toBe(4);
            expect(frame.meta.cols).toBe(4);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("cell");
                expect(entity.metadata.row).toBeLessThan(4);
                expect(entity.metadata.col).toBeLessThan(4);
            }
        });
    });

    it("terminates cleanly for empty and single-pile inputs", () => {
        for (const stones of [[], [7]]) {
            const generator = mod.run({ stones });
            let count = 0;
            let result = generator.next();
            while (!result.done) {
                count += 1;
                result = generator.next();
            }
            expect(count).toBe(1);
        }
    });
});
