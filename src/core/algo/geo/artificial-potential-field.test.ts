/** artificial-potential-field.test.ts - Descent property, greedy check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./artificial-potential-field";

type Cell = [number, number];

function potential(q: Cell, goal: Cell, obstacles: Cell[], rho: number, kAtt: number, kRep: number): number {
    let value = kAtt * Math.hypot(q[0] - goal[0], q[1] - goal[1]);
    for (const o of obstacles) {
        const d = Math.hypot(q[0] - o[0], q[1] - o[1]);
        if (d < rho) value += kRep * (1 - d / rho) ** 2;
    }
    return value;
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 500; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(500);
    return frames;
}

function pathFrom(final: ReturnType<typeof framesFor>[number]): Cell[] {
    const flat = final.meta.path as number[];
    const path: Cell[] = [];
    for (let i = 0; i < flat.length; i += 2) path.push([flat[i]!, flat[i + 1]!]);
    return path;
}

describe("Artificial Potential Field", () => {
    it("produces a strictly descending, obstacle-free path that reaches the goal", () => {
        const input = {
            rows: 8,
            cols: 8,
            start: [0, 0] as Cell,
            goal: [7, 7] as Cell,
            obstacles: [
                [3, 3],
                [3, 4],
                [4, 3],
                [4, 4],
            ] as Cell[],
            rho: 2.5,
            kAtt: 1,
            kRep: 3,
            maxSteps: 60,
        };
        const frames = framesFor(input);
        const final = frames[frames.length - 1]!;
        const path = pathFrom(final);
        const blocked = new Set(input.obstacles.map(([r, c]) => `${r},${c}`));

        expect(final.meta.reached).toBe(true);
        expect(path[0]).toEqual(input.start);
        expect(path[path.length - 1]).toEqual(input.goal);
        const seen = new Set<string>();
        for (let i = 0; i < path.length; i += 1) {
            const key = path[i]!.join(",");
            expect(blocked.has(key)).toBe(false);
            expect(seen.has(key)).toBe(false);
            seen.add(key);
            if (i > 0) {
                const step = Math.max(
                    Math.abs(path[i]![0] - path[i - 1]![0]),
                    Math.abs(path[i]![1] - path[i - 1]![1]),
                );
                expect(step).toBe(1);
                const prevU = potential(path[i - 1]!, input.goal, input.obstacles, 2.5, 1, 3);
                const currU = potential(path[i]!, input.goal, input.obstacles, 2.5, 1, 3);
                expect(currU).toBeLessThan(prevU);
            }
        }
    });

    it("takes the Chebyshev-length diagonal on an empty grid", () => {
        const frames = framesFor({
            rows: 6,
            cols: 6,
            start: [0, 0],
            goal: [5, 5],
            obstacles: [],
            maxSteps: 20,
        });
        const final = frames[frames.length - 1]!;
        const path = pathFrom(final);
        expect(final.meta.reached).toBe(true);
        expect(path.length).toBe(6);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("grid");
            expect(frame.entities.length).toBe(64);
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const entity of frame.entities) {
                expect(entity.metadata["row"]).toBeTypeOf("number");
                expect(entity.metadata["col"]).toBeTypeOf("number");
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
