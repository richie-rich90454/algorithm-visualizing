import { describe, expect, it } from "vitest";
import mod from "./et-tree";
import type { VisualFrame } from "@/types";

type Op = { op: "link" | "cut" | "connected"; u: string; v: string };
type Input = { vertices: string[]; operations: Op[] };

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const sequences = frame.meta["tourSequences"] as string[];
        expect(Array.isArray(sequences)).toBe(true);
        for (const seq of sequences) {
            const parts = seq.split("-");
            for (const v of parts) {
                expect(parts.filter((x) => x === v).length).toBe(2);
            }
        }
    });
}

describe("Euler Tour Tree", () => {
    it("matches an independent connectivity simulation on the default operations", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.vertices.length);

        const adjacency = new Map<string, string[]>(input.vertices.map((v) => [v, []]));
        const connected = (u: string, v: string): boolean => {
            const seen = new Set([u]);
            const stack = [u];
            while (stack.length) {
                const x = stack.pop() as string;
                if (x === v) return true;
                for (const y of adjacency.get(x) ?? []) {
                    if (!seen.has(y)) {
                        seen.add(y);
                        stack.push(y);
                    }
                }
            }
            return false;
        };
        const expected: boolean[] = [];
        for (const op of input.operations) {
            if (op.op === "link" && !connected(op.u, op.v)) {
                adjacency.get(op.u)?.push(op.v);
                adjacency.get(op.v)?.push(op.u);
            } else if (op.op === "cut" && connected(op.u, op.v)) {
                adjacency.set(op.u, (adjacency.get(op.u) ?? []).filter((x) => x !== op.v));
                adjacency.set(op.v, (adjacency.get(op.v) ?? []).filter((x) => x !== op.u));
            } else if (op.op === "connected") {
                expected.push(connected(op.u, op.v));
            }
        }
        const reported = frames
            .filter((f) => typeof f.meta["connected"] === "boolean")
            .map((f) => Boolean(f.meta["connected"]));
        expect(reported).toEqual(expected);
    });

    it("matches connectivity on random link and cut sequences", () => {
        const vertices = ["A", "B", "C", "D", "E"];
        for (let trial = 0; trial < 10; trial += 1) {
            const operations: Op[] = [];
            for (let i = 0; i < 12; i += 1) {
                const u = vertices[Math.floor(Math.random() * vertices.length)] as string;
                const v = vertices[Math.floor(Math.random() * vertices.length)] as string;
                const options: Op["op"][] = ["link", "cut", "connected"];
                if (u !== v) {
                    operations.push({ op: options[Math.floor(Math.random() * options.length)] as Op["op"], u, v });
                }
            }
            const frames = [...mod.run({ vertices, operations })];
            const adjacency = new Map<string, string[]>(vertices.map((x) => [x, []]));
            const connected = (u: string, v: string): boolean => {
                const seen = new Set([u]);
                const stack = [u];
                while (stack.length) {
                    const x = stack.pop() as string;
                    if (x === v) return true;
                    for (const y of adjacency.get(x) ?? []) {
                        if (!seen.has(y)) {
                            seen.add(y);
                            stack.push(y);
                        }
                    }
                }
                return false;
            };
            const expected: boolean[] = [];
            for (const op of operations) {
                if (op.op === "link" && !connected(op.u, op.v)) {
                    adjacency.get(op.u)?.push(op.v);
                    adjacency.get(op.v)?.push(op.u);
                } else if (op.op === "cut" && (adjacency.get(op.u) ?? []).includes(op.v)) {
                    adjacency.set(op.u, (adjacency.get(op.u) ?? []).filter((x) => x !== op.v));
                    adjacency.set(op.v, (adjacency.get(op.v) ?? []).filter((x) => x !== op.u));
                } else if (op.op === "connected") {
                    expected.push(connected(op.u, op.v));
                }
            }
            const reported = frames
                .filter((f) => typeof f.meta["connected"] === "boolean")
                .map((f) => Boolean(f.meta["connected"]));
            expect(reported).toEqual(expected);
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
