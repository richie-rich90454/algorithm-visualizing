/**
 * useShare.ts – Deep links, clipboard helpers, and share metadata.
 *
 * A link carries the selected algorithm and the current step in the query
 * string, for example `/algorithm-visualizing/?algo=bubble-sort&step=4`. Links
 * are built from `import.meta.env.BASE_URL` so the GitHub Pages base path is
 * preserved. The same helper produces an embed snippet and derives a title and
 * description from an algorithm's metadata.
 */

import type { AlgorithmMeta } from "@/core/manifest";
import { categoryLabel } from "./categories";

export interface DeepLink {
    id: string | null;
    step: number;
}

/** @returns The algorithm and step encoded in the current URL. */
export function readDeepLink(): DeepLink {
    if (typeof window === "undefined") {
        return { id: null, step: 0 };
    }
    const params = new URLSearchParams(window.location.search);
    const id = params.get("algo");
    const raw = params.get("step");
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return { id, step: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 };
}

/** @returns A shareable URL for an algorithm and step. */
export function buildShareUrl(id: string | null, step: number): string {
    if (typeof window === "undefined") {
        return "";
    }
    const base = window.location.origin + (import.meta.env.BASE_URL || "/");
    const url = new URL(base);
    if (id) {
        url.searchParams.set("algo", id);
        url.searchParams.set("step", String(Math.max(0, Math.floor(step))));
    }
    return url.toString();
}

/** @returns An iframe snippet that embeds the current visualization. */
export function embedSnippet(url: string): string {
    const embedded = new URL(url);
    embedded.searchParams.set("embed", "1");
    return `<iframe src="${embedded.toString()}" width="800" height="600" title="Algorithm visualization" loading="lazy"></iframe>`;
}

/** Keep the address bar in sync without adding a history entry per step. */
export function syncUrl(id: string | null, step: number): void {
    if (typeof window === "undefined") {
        return;
    }
    window.history.replaceState(null, "", buildShareUrl(id, step));
}

/** Copy text to the clipboard, with a fallback for older browsers. */
export async function copyText(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to the legacy selection-based copy below.
        }
    }
    if (typeof document === "undefined") {
        return false;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch {
        copied = false;
    }
    document.body.removeChild(area);
    return copied;
}

/** @returns The share title and description for an algorithm. */
export function shareContent(meta: AlgorithmMeta): { title: string; description: string } {
    return {
        title: `${meta.name} - Algorithmic Visualization Engine`,
        description: `${meta.name} is a ${categoryLabel(meta.category).toLowerCase()} algorithm with ${meta.complexity.time} time and ${meta.complexity.space} space complexity. Step through it interactively, offline and free.`,
    };
}

/** Update the document title and description meta to match the current page. */
export function applyShareMetadata(meta: AlgorithmMeta | null): void {
    if (typeof document === "undefined") {
        return;
    }
    if (!meta) {
        document.title = "Algorithmic Visualization Engine";
        return;
    }
    const content = shareContent(meta);
    document.title = content.title;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
        description = document.createElement("meta");
        description.name = "description";
        document.head.appendChild(description);
    }
    description.content = content.description;
}
