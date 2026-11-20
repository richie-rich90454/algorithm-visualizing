import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./paranoid-search";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.entities.forEach((entity) => expect(Number.isFinite(entity.x)).toBe(true));
    });
}

/** Independent paranoid backup: root player maximizes, all others minimize. */
function bruteParanoid(leaves: number[], i: number, level: number, players: number): number {
    if (i >= 27) return leaves[i - 27] ?? 0;
    const children = [bruteParanoid(leaves, i * 3, level + 1, players),
        bruteParanoid(leaves, i * 3 + 1, level + 1, players),
        bruteParanoid(leaves, i * 3 + 2, level + 1, players)];
    return level % players === 0 ? Math.max(...children) : Math.min(...children);
}

const leaves = [4, 2, 7, 1, 8, 3, 6, 5, 2, 9, 4, 1, 7, 3, 6, 8, 2, 5, 4, 9, 1, 6, 3, 7, 5, 2, 8];

describe("Paranoid multi-player search", () => {
    it("matches an independent paranoid backup for two, three and four players", () => {
        for (const players of [2, 3, 4]) {
            const fs = frames({ leaves, players });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(Number(last?.meta["value"])).toBe(bruteParanoid(leaves, 1, 0, players));
        }
    });

    it("reduces to ordinary minimax with two players and terminates", () => {
        const two = frames({ leaves, players: 2 });
        const three = frames({ leaves, players: 3 });
        shapes(two);
        shapes(three);
        const minimax = bruteParanoid(leaves, 1, 0, 2);
        expect(Number(two[two.length - 1]?.meta["value"])).toBe(minimax);
        expect(Number(three[three.length - 1]?.meta["evaluated"])).toBeGreaterThan(0);
    });
});
