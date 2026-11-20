/** knuth-plass.test.ts - Brute-force layout check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import knuthPlass from "./knuth-plass";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(knuthPlass.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        frame.entities.forEach((entity) => expect(entity.type).toBe("cell"));
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

/** Enumerate every subset of break positions and compute its total badness. */
function bruteCost(words: string[], width: number): number {
    const n = words.length;
    let best = Infinity;
    for (let mask = 0; mask < 2 ** Math.max(0, n - 1); mask += 1) {
        let lineLength = 0;
        let total = 0;
        let lineCount = 1;
        let feasible = true;
        for (let i = 0; i < n; i += 1) {
            lineLength += words[i]?.length + (lineLength > 0 ? 1 : 0);
            const isLast = i === n - 1;
            const isBreak = i < n - 1 && ((mask >> i) & 1) === 1;
            if (lineLength > width) {
                feasible = false;
                break;
            }
            if (isBreak || isLast) {
                if (!isLast) {
                    total += (width - lineLength) ** 2;
                    lineCount += 1;
                }
                lineLength = 0;
            }
        }
        if (feasible) {
            best = Math.min(best, total);
        }
    }
    return best;
}

describe("Knuth-Plass", () => {
    it("matches brute-force minimum badness", () => {
        const cases = [
            { words: ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"], lineWidth: 12 },
            { words: ["a", "bb", "ccc", "dddd", "e"], lineWidth: 6 },
            { words: ["one"], lineWidth: 10 },
            { words: ["ab", "cd", "ef", "gh"], lineWidth: 5 },
        ];
        for (const input of cases) {
            const frames = sumAll(knuthPlass.run(input));
            const final = frames[frames.length - 1];
            expect(final?.meta["bestCost"]).toBe(bruteCost(input.words, input.lineWidth));
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(knuthPlass.run(knuthPlass.defaultInput)));
        const generator = knuthPlass.run(knuthPlass.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
