/**
 * manifest.test.ts - Regression net for the lazy-loading registry.
 *
 * The production bundle ships only this manifest (metadata) plus the app
 * shell; every algorithm's code is a separate chunk fetched on demand.
 * These checks guarantee the manifest stays faithful: one entry and one
 * working loader per algorithm, with metadata identical to the live module.
 */

import { describe, expect, it } from "vitest";
import { LOADERS, MANIFEST } from "./manifest";

describe("manifest", () => {
    it("covers every algorithm exactly once", () => {
        expect(MANIFEST.length).toBe(771);
        expect(new Set(MANIFEST.map((m) => m.id)).size).toBe(771);
        expect(Object.keys(LOADERS).sort()).toEqual(MANIFEST.map((m) => m.id).sort());
    });

    it("every loader resolves to the module with the same id", async () => {
        for (const meta of MANIFEST) {
            const loader = LOADERS[meta.id];
            expect(loader).toBeDefined();
            const module = (await (loader as () => Promise<{ default: { id: string } }>)()).default;
            expect(module.id).toBe(meta.id);
        }
    }, 300000);

    it("manifest metadata matches the live modules", async () => {
        const mods = import.meta.glob<{ default: Record<string, unknown> }>(
            ["./algo/*/*.ts", "!./algo/*/*.test.ts", "!./algo/*/*-util.ts"],
            { eager: true },
        );
        expect(Object.keys(mods).length).toBe(771);
        const bad: string[] = [];
        for (const meta of MANIFEST) {
            const hit = Object.keys(mods).find((f) => f.endsWith(`/${meta.id}.ts`));
            if (!hit) {
                bad.push(`${meta.id}: no file`);
                continue;
            }
            const live = (mods[hit] as { default: Record<string, unknown> }).default;
            for (const key of [
                "id",
                "name",
                "category",
                "complexity",
                "defaultInput",
                "visualType",
            ]) {
                const mine = JSON.stringify((meta as unknown as Record<string, unknown>)[key]);
                if (mine !== JSON.stringify(live[key])) {
                    bad.push(`${meta.id}.${key} differs`);
                }
            }
        }
        expect(bad).toEqual([]);
    }, 300000);
});
