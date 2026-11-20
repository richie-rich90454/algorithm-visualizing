import { describe, expect, it } from "vitest";
import mod from "./af-heap";

type Op = ["insert", number] | ["decrease", number, number] | ["delete-min"];

function checkFrames(frames: ReturnType<typeof mod.run> extends Generator<infer F> ? F[] : never): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 12);
        expect(frame.meta).toBeDefined();
    });
}

function reference(ops: Op[]): number[] {
    const handles = new Map<number, number>();
    let next = 0;
    const out: number[] = [];
    for (const op of ops) {
        if (op[0] === "insert") {
            handles.set(next, op[1]);
            next += 1;
        } else if (op[0] === "decrease") {
            const current = handles.get(op[1]);
            if (current !== undefined && op[2] < current) handles.set(op[1], op[2]);
        } else {
            let bestId = -1;
            let bestKey = Infinity;
            for (const [id, key] of handles) {
                if (key < bestKey || (key === bestKey && id < bestId)) {
                    bestKey = key;
                    bestId = id;
                }
            }
            if (bestId >= 0) {
                handles.delete(bestId);
                out.push(bestKey);
            }
        }
    }
    return out;
}

describe("AF-Heap", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        checkFrames(frames);
    });

    it("delete-min returns the live keys in sorted order across random batches", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const ops: Op[] = [];
            for (let i = 0; i < 12; i += 1) ops.push(["insert", Math.floor(Math.random() * 100)]);
            for (let i = 0; i < 5; i += 1) {
                ops.push(["decrease", Math.floor(Math.random() * 12), Math.floor(Math.random() * 50)]);
            }
            for (let i = 0; i < 10; i += 1) ops.push(["delete-min"]);
            const frames = [...mod.run({ ops })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const extracted = (final?.meta.extracted as number[]) ?? [];
            expect(extracted).toEqual(reference(ops));
        }
    });

    it("handles an empty operation batch", () => {
        const frames = [...mod.run({ ops: [] })];
        checkFrames(frames);
        expect((frames[frames.length - 1]?.meta.extracted as number[])).toEqual([]);
    });
});
