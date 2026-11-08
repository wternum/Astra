/**
 * Curated palettes for knowledge cards and the knowledge network.
 *
 * Every entry gets a five-role token set (canvas / surface / text / accent /
 * highlight) so the library reads like a design system rather than a list.
 */
export interface KnowledgePalette {
  id: string;
  label: string;
  hue: number;
  colors: { canvas: string; surface: string; text: string; accent: string; highlight: string };
}

export const PALETTES: KnowledgePalette[] = [
  {
    id: "violet", label: "星云紫", hue: 268,
    colors: {
      canvas: "#14112b", surface: "#211b45", text: "#e7e2ff", accent: "#a78bfa", highlight: "#d8ccff",
    },
  },
  {
    id: "amber", label: "流星金", hue: 34,
    colors: {
      canvas: "#26190c", surface: "#3d2a12", text: "#ffe7c2", accent: "#f0a54a", highlight: "#ffd9a0",
    },
  },
  {
    id: "cyan", label: "深空青", hue: 194,
    colors: {
      canvas: "#0a1d26", surface: "#12303c", text: "#d5f2ff", accent: "#4fc3e8", highlight: "#a7e6ff",
    },
  },
  {
    id: "rose", label: "霓虹粉", hue: 338,
    colors: {
      canvas: "#29101c", surface: "#451a2c", text: "#ffdbe6", accent: "#f06f9d", highlight: "#ffb4ca",
    },
  },
  {
    id: "lime", label: "极光绿", hue: 156,
    colors: {
      canvas: "#0c211a", surface: "#15382b", text: "#d7f8e6", accent: "#57d19b", highlight: "#a3f0cd",
    },
  },
  {
    id: "slate", label: "岩石灰", hue: 218,
    colors: {
      canvas: "#161a22", surface: "#242c38", text: "#dde5f0", accent: "#8ea4c2", highlight: "#c2d2e6",
    },
  },
];

export function paletteById(id?: string): KnowledgePalette {
  return PALETTES.find(item => item.id === id) || PALETTES[0];
}

/** Stable palette for entries that were stored before accent selection existed. */
export function paletteForEntry(entry: { category?: string; accent?: string; id?: number }) {
  if (entry.accent && PALETTES.some(item => item.id === entry.accent)) return paletteById(entry.accent);
  const byCategory: Record<string, string> = {
    品牌: "amber", 写作: "rose", 开发: "cyan", 分析: "lime",
    营销: "amber", 学习: "violet", 数据: "cyan", 效率: "slate", 通用: "slate",
  };
  const fallback = byCategory[entry.category || "通用"] || "violet";
  return paletteById(fallback);
}

/** Hex label for the swatch tooltip, resolved from the CSS string. */
export function swatchHex(value: string) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return hex ? value.trim().toUpperCase() : value.trim();
}
