/**
 * hinted-handoff.test.ts - Replica convergence, hint accuracy, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    applyWrites,
    hashKey,
    preferenceList,
    replayHints,
    type Write,
} from "./hinted-handoff";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], nodeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodeCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hinted Handoff", () => {
    it("converges every replica to the last value after replay", () => {
        const nodes = [0, 1, 2, 3, 4];
        const down = [2, 4];
        const writes: Write[] = [
            { key: "a", value: 1 },
            { key: "b", value: 9 },
            { key: "a", value: 7 },
            { key: "c", value: 5 },
            { key: "a", value: 12 },
        ];
        const state = applyWrites(nodes, down, 3, writes);

        // Hints exist only for down nodes and total the writes aimed at them.
        let expectedHints = 0;
        for (const write of writes) {
            for (const replica of preferenceList(nodes, write.key, 3)) {
                if (down.includes(replica)) expectedHints += 1;
            }
        }
        let actualHints = 0;
        for (const list of state.hints.values()) actualHints += list.length;
        expect(actualHints).toBe(expectedHints);
        expect([...state.hints.keys()].every((id) => down.includes(id))).toBe(true);

        replayHints(state);
        expect(state.hints.size).toBe(0);
        const latest = new Map<string, number>();
        for (const write of writes) latest.set(write.key, write.value);
        for (const [key, value] of latest) {
            for (const replica of preferenceList(nodes, key, 3)) {
                expect(state.stored.get(replica)!.get(key)).toBe(value);
            }
        }
    });

    it("keeps deterministic preference lists and bounded hash values", () => {
        const nodes = [0, 1, 2, 3];
        expect(hashKey("a", 4)).toBeGreaterThanOrEqual(0);
        expect(hashKey("a", 4)).toBeLessThan(4);
        for (const key of ["a", "b", "c"]) {
            const list = preferenceList(nodes, key, 3);
            expect(list.length).toBe(3);
            expect(new Set(list).size).toBe(3);
            expect(list).toEqual(preferenceList(nodes, key, 3));
        }
        expect(preferenceList(nodes, "a", 10).length).toBe(4);
    });

    it("produces well-formed frames with an empty final hint store", () => {
        const input = mod.defaultInput as {
            nodes: number[];
            down: number[];
            replicationFactor: number;
            writes: Write[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.nodes.length);
        expect(Number(frames[frames.length - 1]?.meta["hints"])).toBe(0);
        expect(frames.some((frame) => Number(frame.meta["hints"]) > 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
