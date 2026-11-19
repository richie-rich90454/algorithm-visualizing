import { describe, expect, it } from "vitest";
import mod from "./tree-automaton-traversal";
import type { VisualFrame } from "@/types";

type Rule = { label: string; children: string[]; result: string };
type Input = { parentMap: Record<string, string | null>; labels: Record<string, string>; rules: Rule[]; accepting: string[] };

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Tree Automaton Traversal", () => {
    it("assigns the right states and verdict on the default tree", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, Object.keys(input.labels).length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["rootState"]).toBe("odd");
        expect(last?.["accepted"]).toBe(true);
    });

    it("agrees with an independent parity check on random full binary trees", () => {
        for (let trial = 0; trial < 12; trial += 1) {
            const parentMap: Record<string, string | null> = { B: "A", C: "A" };
            const labels: Record<string, string> = { A: "node", B: "node", C: "node" };
            const leafParents = ["B", "C", "B", "C"];
            const leaves = ["D", "E", "F", "G"];
            leaves.forEach((leaf, i) => {
                parentMap[leaf] = leafParents[i] as string;
                labels[leaf] = Math.random() < 0.5 ? "a" : "leaf";
            });
            const input = mod.defaultInput as Input;
            const frames = [...mod.run({ ...input, parentMap, labels })];
            const odd = leaves.filter((leaf) => labels[leaf] === "a").length % 2 === 1;
            expect(frames[frames.length - 1]?.meta["accepted"]).toBe(odd);
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
