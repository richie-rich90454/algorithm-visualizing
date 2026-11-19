/**
 * pattern-database-search.test.ts - Admissibility and optimality checks.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./pattern-database-search";

const GOAL = [1, 2, 3, 4, 5, 0];

function neighborIndices(index: number): number[] {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const out: number[] = [];
    if (row > 0) out.push(index - 3);
    if (row < 1) out.push(index + 3);
    if (col > 0) out.push(index - 1);
    if (col < 2) out.push(index + 1);
    return out;
}

function swap(puzzle: number[], a: number, b: number): number[] {
    const next = [...puzzle];
    const tmp = next[a];
    next[a] = next[b];
    next[b] = tmp;
    return next;
}

function trueDistances(): Map<string, number> {
    const goalKey = GOAL.join(",");
    const distances = new Map<string, number>([[goalKey, 0]]);
    const queue: number[][] = [[...GOAL]];
    for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head];
        if (!current) continue;
        const d = distances.get(current.join(",")) ?? 0;
        const blank = current.indexOf(0);
        for (const target of neighborIndices(blank)) {
            const next = swap(current, blank, target);
            const key = next.join(",");
            if (!distances.has(key)) {
                distances.set(key, d + 1);
                queue.push(next);
            }
        }
    }
    return distances;
}

function randomStart(steps: number): number[] {
    let state = [...GOAL];
    for (let i = 0; i < steps; i += 1) {
        const blank = state.indexOf(0);
        const options = neighborIndices(blank);
        state = swap(state, blank, options[Math.floor(Math.random() * options.length)] ?? 0);
    }
    return state;
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(6);
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

describe("Pattern Database Search", () => {
    const distances = trueDistances();

    it("database heuristics never exceed the true distance", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const start = randomStart(12);
            const frames = [...module.run({ start })];
            verifyFrameShapes(frames);
            for (const frame of frames) {
                const h = Number(frame.meta.heuristic ?? 0);
                if (h <= 0) continue;
                const puzzle = frame.entities.map((e) => Number(e.value));
                const trueD = distances.get(puzzle.join(","));
                if (trueD !== undefined) expect(h).toBeLessThanOrEqual(trueD);
            }
        }
    });

    it("finds an optimal-length solution from solvable starts", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const start = randomStart(10);
            const frames = [...module.run({ start })];
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const expected = distances.get(start.join(","));
            expect(expected).toBeDefined();
            expect(final?.meta.solutionLength).toBe(expected);
        }
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
