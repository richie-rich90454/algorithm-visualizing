/** dulmage-mendelsohn-decomposition.test.ts - Forced-edge property vs brute force. */

import { describe, expect, it } from "vitest";
import mod from "./dulmage-mendelsohn-decomposition";
import type { VisualFrame } from "@/types";

interface Input {
    left: string[];
    right: string[];
    edges: Array<[string, string]>;
}

/** Enumerate every maximum matching and return the edges common to all of them. */
function forcedEdges(input: Input): { size: number; forced: Set<string> } {
    let best = -1;
    let matchings: Set<string>[] = [];
    const current = new Set<string>();
    const usedRight = new Set<string>();
    const visit = (index: number): void => {
        if (index === input.left.length) {
            if (current.size > best) {
                best = current.size;
                matchings = [];
            }
            if (current.size === best) {
                matchings.push(new Set(current));
            }
            return;
        }
        const l = input.left[index] as string;
        visit(index + 1);
        for (const [from, r] of input.edges) {
            if (from !== l || usedRight.has(r)) {
                continue;
            }
            usedRight.add(r);
            current.add(`${l}|${r}`);
            visit(index + 1);
            current.delete(`${l}|${r}`);
            usedRight.delete(r);
        }
    };
    visit(0);
    const forced = new Set<string>();
    for (const key of matchings[0] ?? []) {
        if (matchings.every((m) => m.has(key))) {
            forced.add(key);
        }
    }
    return { size: best, forced };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DulmageMendelsohnDecomposition", () => {
    it("identifies exactly the edges present in every maximum matching", () => {
        const cases: Input[] = [
            {
                left: ["A", "B", "C", "D"],
                right: ["1", "2", "3", "4"],
                edges: [
                    ["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"],
                    ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"],
                ],
            },
            { left: ["A", "B"], right: ["1"], edges: [["A", "1"], ["B", "1"]] },
            { left: ["A", "B"], right: ["1", "2"], edges: [["A", "1"], ["B", "1"], ["B", "2"]] },
            {
                left: ["A", "B"],
                right: ["1", "2"],
                edges: [["A", "1"], ["A", "2"], ["B", "1"], ["B", "2"]],
            },
            { left: ["A"], right: ["1"], edges: [["A", "1"]] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = forcedEdges(input);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(Number(last.meta["matchingSize"])).toBe(expected.size);
            const classes = last.meta["classes"] as string[];
            const forced = new Set(
                classes.filter((c) => c.endsWith(":forced")).map((c) => c.slice(0, -":forced".length).replace("-", "|")),
            );
            expect([...forced].sort()).toEqual([...expected.forced].sort());
            const counts = ["forced", "underdetermined", "overdetermined", "cyclic"].reduce(
                (sum, key) => sum + Number(last.meta[key] ?? 0),
                0,
            );
            expect(counts).toBe(expected.size);
        }
    });

    it("terminates cleanly and is deterministic", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
        const again = [...mod.run(mod.defaultInput)];
        expect(frames[frames.length - 1]?.meta["classes"]).toEqual(again[again.length - 1]?.meta["classes"]);
    });
});
