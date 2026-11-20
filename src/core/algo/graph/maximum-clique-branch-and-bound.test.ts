import { describe, expect, it } from "vitest";
import module from "./maximum-clique-branch-and-bound";

function maxCliqueSize(graph: Record<string, string[]>): number {
    const frames = [...module.run({ graph })];
    return frames[frames.length - 1]!.meta.bestSize as number;
}

/** Exhaustive reference over all vertex subsets. */
function bruteForceMaxClique(graph: Record<string, string[]>): number {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const adj = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, list] of Object.entries(graph)) {
        for (const t of list) {
            if (u === t || !adj.has(t)) continue;
            adj.get(u)!.add(t);
            adj.get(t)!.add(u);
        }
    }
    let best = 0;
    for (let mask = 0; mask < 1 << labels.length; mask += 1) {
        const group = labels.filter((_, i) => (mask >> i) & 1);
        if (group.every((a) => group.every((b) => a === b || adj.get(a)!.has(b)))) {
            best = Math.max(best, group.length);
        }
    }
    return best;
}

describe("maximum-clique-branch-and-bound", () => {
    it("finds the true maximum clique on random graphs (brute force)", () => {
        let seed = 777000;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 80; t += 1) {
            const n = 1 + (rand() % 10);
            const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Record<string, string[]> = Object.fromEntries(labels.map((v) => [v, [] as string[]]));
            const p = (rand() % 80) / 100 + 0.1;
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rand() / 0x7fffffff < p) {
                        graph[labels[i] as string]!.push(labels[j] as string);
                        graph[labels[j] as string]!.push(labels[i] as string);
                    }
                }
            }
            expect(maxCliqueSize(graph), JSON.stringify(graph)).toBe(bruteForceMaxClique(graph));
        }
    });

    it("the reported clique is genuinely a clique", () => {
        const graph: Record<string, string[]> = {
            A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"],
            D: ["A", "B", "C", "E"], E: ["D", "F"], F: ["E"],
        };
        const frames = [...module.run({ graph })];
        const clique = frames[frames.length - 1]!.meta.best as string[];
        for (const a of clique) {
            for (const b of clique) {
                if (a !== b) expect(graph[a]!.includes(b) || graph[b]!.includes(a)).toBe(true);
            }
        }
        expect(clique.length).toBe(4);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges.length).toBeGreaterThanOrEqual(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("graph");
            expect(frame.meta).toHaveProperty("branches");
            expect(frame.meta).toHaveProperty("bestSize");
        });
    });
});
