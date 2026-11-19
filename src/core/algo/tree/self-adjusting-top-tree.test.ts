import { describe, expect, it } from "vitest";
import mod from "./self-adjusting-top-tree";
import type { VisualFrame } from "@/types";

type Op = { op: "link" | "cut" | "query"; a: string; b: string; weight?: number };
type Input = { path: string[]; weights: number[]; operations: Op[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Self-Adjusting Top Tree", () => {
    it("answers the default queries correctly", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const answers = frames
            .filter((f) => typeof f.meta["answer"] === "number")
            .map((f) => Number(f.meta["answer"]));
        expect(answers).toEqual([7, 7, 4]);
        expect(Number(frames[frames.length - 1]?.meta["rotations"] ?? 0)).toBeGreaterThan(0);
    });

    it("matches a brute-force path scan on random operation sequences", () => {
        for (let trial = 0; trial < 10; trial += 1) {
            const path = ["A", "B", "C", "D", "E"];
            const weights = [1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)];
            const operations: Op[] = [
                { op: "query", a: "A", b: "E" },
                { op: "query", a: "B", b: "D" },
                { op: "cut", a: "C", b: "D" },
                { op: "query", a: "A", b: "C" },
            ];
            const frames = [...mod.run({ path: [...path], weights, operations })];
            const reported = frames
                .filter((f) => typeof f.meta["answer"] === "number" && f.meta["cut"] === undefined)
                .map((f) => Number(f.meta["answer"]));
            const brute: number[] = [];
            const edgeWeight = new Map<string, number>();
            for (let i = 0; i < weights.length; i += 1) {
                edgeWeight.set(`${path[i]}-${path[i + 1]}`, weights[i] as number);
            }
            const maxOn = (a: string, b: string): number => {
                const i = path.indexOf(a);
                const j = path.indexOf(b);
                const lo = Math.min(i, j);
                const hi = Math.max(i, j);
                let best = -Infinity;
                for (let k = lo; k < hi; k += 1) {
                    best = Math.max(best, edgeWeight.get(`${path[k]}-${path[k + 1]}`) ?? -Infinity);
                }
                return best;
            };
            brute.push(maxOn("A", "E"));
            brute.push(maxOn("B", "D"));
            path.splice(3, 1);
            brute.push(maxOn("A", "C"));
            expect(reported).toEqual(brute);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
