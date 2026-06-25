// Fixed low-fidelity grayscale palette (DESIGN §4.1). No brand colors / real
// images. Used as inline styles so the same DOM drives screen render + export.

export const PALETTE = {
  cardBg: "#FFFFFF",
  cardBorder: "#E2E2E2",
  sectionBg: "#F5F5F5",
  border: "#D0D0D0",
  borderStrong: "#9CA3AF",
  textHeading: "#374151",
  textBody: "#6B7280",
  textFaint: "#9CA3AF",
  primaryBg: "#374151",
  primaryText: "#FFFFFF",
  imageBg: "#F0F0F0",
  fill: "#E5E7EB", // avatar / badge fill / placeholder bars
  divider: "#E2E2E2",
  white: "#FFFFFF",
} as const;

export const FONT = {
  family:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  h1: 28,
  h2: 22,
  h3: 18,
  body: 14,
  caption: 12,
  label: 12,
} as const;

export const BADGE_TONES: Record<string, { bg: string; color: string }> = {
  neutral: { bg: "#E5E7EB", color: "#374151" },
  info: { bg: "#DBEAFE", color: "#1E40AF" },
  success: { bg: "#DCFCE7", color: "#166534" },
  warning: { bg: "#FEF3C7", color: "#92400E" },
  danger: { bg: "#FEE2E2", color: "#991B1B" },
};
