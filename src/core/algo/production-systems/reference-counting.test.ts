/**
 * reference-counting.test.ts - Independent reclamation reference, frame shape,
 * reachability property, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./reference-counting";
import type { VisualFrame } from "@/types";

type Op =
    | { op: "new"; id: string }
    | { op: "set"; from: string; to: string }
    | { op: "drop"; id: string };

/** Independent replay with a fresh count computation at each step. */
function reference(operations: Op[]) {
    const objects = new Map<string, string[]>();
    const roots = new Set<string>();
    const created: string[] = [];
    const freed: string[] = [];
    const tally = (id: string) => {
        let value = roots.has(id) ? 1 : 0;
        for (const refs of objects.values()) {
            for (const target of refs) {
                if (target === id) {
                    value += 1;
                }
            }
        }
        return value;
    };
    for (const operation of operations) {
        if (operation.op === "new") {
            if (!objects.has(operation.id)) {
                objects.set(operation.id, []);
                created.push(operation.id);
            }
            roots.add(operation.id);
        } else if (operation.op === "set") {
            const refs = objects.get(operation.from);
            if (refs && objects.has(operation.to)) {
                if (refs.length === 0) {
                    refs.push(operation.to);
                } else {
                    refs[0] = operation.to;
                }
            }
        } else {
            roots.delete(operation.id);
            let again = true;
            while (again) {
                again = false;
                for (const id of Array.from(objects.keys())) {
                    if (!roots.has(id) && tally(id) === 0) {
                        objects.delete(id);
                        freed.push(id);
                        again = true;
                    }
                }
            }
        }
    }
    return { created, freed, live: Array.from(objects.keys()), counts: created.map((id) => (objects.has(id) ? tally(id) : 0)) };
}

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(1);
        expect(frame.entities[0]?.id).toBe("heap");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        if (index === frames.length - 1) {
            expect(frame.entities.length).toBe(expectedBars);
        }
    });
}

describe("Reference Counting", () => {
    it("matches an independent reclamation reference on the default trace", () => {
        const operations = (mod.defaultInput as { operations: Op[] }).operations;
        const frames = [...mod.run(mod.defaultInput)];
        const expected = reference(operations);
        checkFrames(frames, 1 + expected.created.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["freed"]).toEqual(expected.freed);
        expect(final?.["counts"]).toEqual(expected.counts);
        expect(final?.["live"]).toBe(0);
    });

    it("reclaims exactly the unreachable objects in an acyclic graph", () => {
        const operations: Op[] = [
            { op: "new", id: "R" },
            { op: "new", id: "P" },
            { op: "new", id: "Q" },
            { op: "set", from: "R", to: "P" },
            { op: "set", from: "P", to: "Q" },
            { op: "drop", id: "Q" },
            { op: "drop", id: "P" },
            { op: "drop", id: "R" },
        ];
        const frames = [...mod.run({ operations })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["freed"]).toEqual(["R", "P", "Q"]);
        expect(final?.["live"]).toBe(0);
        expect(final?.["roots"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
