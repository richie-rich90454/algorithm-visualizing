/**
 * painting-fence-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./painting-fence-dp";
import type { VisualFrame } from "@/types";

/** Enumerate every coloring and count those without three equal neighbors. */
function bruteWays(posts: number, colors: number): number {
    if (posts <= 0 || colors <= 0) return 0;
    let count = 0;
    const total = colors ** posts;
    for (let code = 0; code < total; code += 1) {
        let x = code;
        const row: number[] = [];
        for (let i = 0; i < posts; i += 1) {
            row.push(x % colors);
            x = Math.floor(x / colors);
        }
        let valid = true;
        for (let i = 2; i < row.length; i += 1) {
            if (row[i] === row[i - 1] && row[i - 1] === row[i - 2]) {
                valid = false;
                break;
            }
        }
        if (valid) count += 1;
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Painting Fence DP", () => {
    it("matches exhaustive enumeration on small instances", () => {
        for (let posts = 0; posts <= 6; posts += 1) {
            for (let colors = 1; colors <= 3; colors += 1) {
                const frames = [...mod.run({ posts, colors })];
                checkFrames(frames);
                expect(frames[frames.length - 1]?.meta["answer"]).toBe(bruteWays(posts, colors));
            }
        }
    });

    it("reports the default answer of 180", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(180);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
