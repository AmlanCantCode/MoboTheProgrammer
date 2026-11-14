export type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface Crime {
  id: string;
  title: string;
  summary: string;
  category: string;
  severity: Severity;
  city: string;
  state: string;
  lat: number;
  lng: number;
  source: string;
  link: string;
  publishedAt: string;
}

export const SEVERITY: Record<
  Severity,
  { label: string; color: string; rgb: string; rank: number }
> = {
  HIGH: { label: "High", color: "#fb3b64", rgb: "251,59,100", rank: 0 },
  MEDIUM: { label: "Medium", color: "#f5f5f7", rgb: "245,245,247", rank: 1 },
  LOW: { label: "Low", color: "#6b7280", rgb: "107,114,128", rank: 2 },
};

export const CATEGORIES = [
  { value: "ALL", label: "All" },
  { value: "Violent Crime", label: "Violent" },
  { value: "Cybercrime & Fraud", label: "Cyber" },
  { value: "Narcotics & Smuggling", label: "Narcotics" },
  { value: "Theft & Robbery", label: "Theft" },
  { value: "Police Action / Arrest", label: "Police" },
] as const;

/** Where the camera rests: centred on India. */
export const INDIA_VIEW = { lat: 22.59, lng: 78.96, altitude: 1.75 } as const;

/** RSS snippets often arrive as raw HTML (<a><img>…). Reduce to plain text. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.\.\.$/, "…")
    .trim();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
