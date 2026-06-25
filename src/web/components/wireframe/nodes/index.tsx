import type { CSSProperties, ReactNode } from "react";
import {
  Search,
  ChevronDown,
  Check,
  User,
  Home,
  Settings,
  Bell,
  Plus,
  Minus,
  X,
  Menu,
  Star,
  Heart,
  Mail,
  Calendar,
  Trash2,
  Pencil,
  Download,
  Upload,
  Filter,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  LogOut,
  Lock,
  Eye,
  FileText,
  Folder,
  Image as ImageIcon,
  Bookmark,
  Clock,
  Info,
  ChevronRight,
  Square,
  type LucideIcon,
} from "lucide-react";
import { PALETTE, FONT, BADGE_TONES } from "../palette";
import type {
  WireNode,
  TextNode,
  ButtonNode,
  InputNode,
  TextareaNode,
  CheckboxNode,
  RadioNode,
  ToggleNode,
  SelectNode,
  ImageNode,
  AvatarNode,
  IconNode,
  DividerNode,
  BadgeNode,
  NavbarNode,
  TableNode,
  ListNode,
  TabsNode,
} from "@shared/schema/wireframe";

const fill100: CSSProperties = { width: "100%", height: "100%" };

function justify(align?: string): CSSProperties["justifyContent"] {
  return align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
}

// --- Icon resolver (curated set; unknown names fall back to a labeled box) ---

const ICONS: Record<string, LucideIcon> = {
  search: Search, chevrondown: ChevronDown, chevronright: ChevronRight, check: Check,
  user: User, home: Home, settings: Settings, bell: Bell, plus: Plus, minus: Minus,
  x: X, close: X, menu: Menu, star: Star, heart: Heart, mail: Mail, calendar: Calendar,
  trash: Trash2, trash2: Trash2, delete: Trash2, edit: Pencil, pencil: Pencil,
  download: Download, upload: Upload, filter: Filter, more: MoreHorizontal,
  morehorizontal: MoreHorizontal, arrowright: ArrowRight, arrowleft: ArrowLeft,
  logout: LogOut, signout: LogOut, lock: Lock, eye: Eye, file: FileText,
  filetext: FileText, folder: Folder, image: ImageIcon, bookmark: Bookmark,
  clock: Clock, info: Info,
};

function IconGlyph({ name, size, color }: { name: string; size: number; color: string }) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const Cmp = ICONS[key];
  if (Cmp) return <Cmp size={size} color={color} strokeWidth={1.75} />;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px dashed ${PALETTE.borderStrong}`,
        borderRadius: 4,
        color: PALETTE.textFaint,
        fontFamily: FONT.family,
        fontSize: Math.max(8, Math.min(10, size / 2.4)),
        width: size,
        height: size,
        lineHeight: 1,
        overflow: "hidden",
      }}
      title={name}
    >
      {name.slice(0, 3)}
    </span>
  );
}

// --- Composite content -----------------------------------------------------

function NavbarContent({ node }: { node: NavbarNode }) {
  return (
    <div
      style={{
        ...fill100,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "0 16px",
        background: PALETTE.white,
        borderBottom: `1px solid ${PALETTE.cardBorder}`,
        fontFamily: FONT.family,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {node.brand && (
        <span style={{ fontSize: 16, fontWeight: 700, color: PALETTE.textHeading, whiteSpace: "nowrap" }}>
          {node.brand}
        </span>
      )}
      <div style={{ display: "flex", gap: 18, overflow: "hidden" }}>
        {(node.links ?? []).map((l, i) => (
          <span key={i} style={{ fontSize: 14, color: PALETTE.textBody, whiteSpace: "nowrap" }}>
            {l}
          </span>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {(node.actions ?? []).map((a, i, arr) => {
          const primary = i === arr.length - 1;
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: primary ? PALETTE.primaryBg : "transparent",
                color: primary ? PALETTE.primaryText : PALETTE.textHeading,
                border: primary ? "none" : `1px solid ${PALETTE.borderStrong}`,
              }}
            >
              {a}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TableContent({ node }: { node: TableNode }) {
  const cols = node.columns;
  const rows = Math.max(0, node.rows ?? 5);
  const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols.length || 1}, 1fr)`,
  };
  return (
    <div
      style={{
        ...fill100,
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${PALETTE.cardBorder}`,
        borderRadius: 8,
        overflow: "hidden",
        background: PALETTE.white,
        fontFamily: FONT.family,
        boxSizing: "border-box",
      }}
    >
      <div style={{ ...grid, background: PALETTE.sectionBg, borderBottom: `1px solid ${PALETTE.cardBorder}`, flexShrink: 0 }}>
        {cols.map((c, i) => (
          <div key={i} style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: PALETTE.textHeading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ ...grid, flex: 1, alignItems: "center", borderTop: r === 0 ? "none" : `1px solid ${PALETTE.imageBg}`, minHeight: 28 }}>
            {cols.map((_, c) => (
              <div key={c} style={{ padding: "0 10px" }}>
                <div style={{ height: 8, width: `${55 + ((r + c) % 3) * 12}%`, background: PALETTE.fill, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ListContent({ node }: { node: ListNode }) {
  const items = Math.max(0, node.items ?? 5);
  return (
    <div style={{ ...fill100, display: "flex", flexDirection: "column", fontFamily: FONT.family, boxSizing: "border-box", overflow: "hidden" }}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "0 8px", borderBottom: i === items - 1 ? "none" : `1px solid ${PALETTE.imageBg}`, minHeight: 36 }}>
          {node.withAvatar && <div style={{ width: 32, height: 32, borderRadius: "50%", background: PALETTE.fill, flexShrink: 0 }} />}
          {node.withIcon && !node.withAvatar && (
            <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Square size={18} color={PALETTE.borderStrong} strokeWidth={1.75} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ height: 8, width: "48%", background: PALETTE.fill, borderRadius: 4 }} />
            <div style={{ height: 6, width: "28%", background: PALETTE.imageBg, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabsContent({ node }: { node: TabsNode }) {
  const active = node.activeIndex ?? 0;
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "flex-end", borderBottom: `1px solid ${PALETTE.cardBorder}`, fontFamily: FONT.family, overflow: "hidden", boxSizing: "border-box" }}>
      {node.tabs.map((t, i) => {
        const on = i === active;
        return (
          <div
            key={i}
            style={{
              padding: "0 14px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              fontSize: 14,
              whiteSpace: "nowrap",
              color: on ? PALETTE.textHeading : PALETTE.textFaint,
              fontWeight: on ? 600 : 400,
              borderBottom: on ? `2px solid ${PALETTE.textHeading}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t}
          </div>
        );
      })}
    </div>
  );
}

function ImageContent({ node }: { node: ImageNode }) {
  return (
    <div style={{ ...fill100, position: "relative", background: PALETTE.imageBg, border: `1px solid ${PALETTE.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxSizing: "border-box" }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <line x1="0" y1="0" x2="100%" y2="100%" stroke={PALETTE.border} strokeWidth="1" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke={PALETTE.border} strokeWidth="1" />
      </svg>
      <span style={{ position: "relative", fontFamily: FONT.family, fontSize: 12, color: PALETTE.textFaint, background: PALETTE.imageBg, padding: "2px 6px" }}>
        {node.label ?? "Image"}
        {node.ratio ? ` (${node.ratio})` : ""}
      </span>
    </div>
  );
}

// --- Field helpers ---------------------------------------------------------

function FieldLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: PALETTE.textFaint, fontFamily: FONT.family, marginBottom: 4 }}>{text}</div>;
}

// --- Leaf content dispatch -------------------------------------------------

export function LeafContent({ node }: { node: Exclude<WireNode, { type: "Box" }> }): ReactNode {
  switch (node.type) {
    case "Text":
      return <TextContent node={node} />;
    case "Button":
      return <ButtonContent node={node} />;
    case "Input":
      return <InputContent node={node} />;
    case "Textarea":
      return <TextareaContent node={node} />;
    case "Checkbox":
      return <CheckboxContent node={node} />;
    case "Radio":
      return <RadioContent node={node} />;
    case "Toggle":
      return <ToggleContent node={node} />;
    case "Select":
      return <SelectContent node={node} />;
    case "Image":
      return <ImageContent node={node} />;
    case "Avatar":
      return <AvatarContent node={node} />;
    case "Icon":
      return <IconContent node={node} />;
    case "Divider":
      return <DividerContent node={node} />;
    case "Badge":
      return <BadgeContent node={node} />;
    case "Navbar":
      return <NavbarContent node={node} />;
    case "Table":
      return <TableContent node={node} />;
    case "List":
      return <ListContent node={node} />;
    case "Tabs":
      return <TabsContent node={node} />;
    default:
      return null;
  }
}

function TextContent({ node }: { node: TextNode }) {
  const role = node.role ?? "body";
  const size = role === "h1" ? FONT.h1 : role === "h2" ? FONT.h2 : role === "h3" ? FONT.h3 : role === "caption" || role === "label" ? FONT.caption : FONT.body;
  const color = role === "h1" || role === "h2" || role === "h3" ? PALETTE.textHeading : role === "body" ? PALETTE.textBody : PALETTE.textFaint;
  const weight = role.startsWith("h") ? 700 : role === "label" ? 600 : 400;
  return (
    <div
      style={{
        ...fill100,
        display: "flex",
        alignItems: "center",
        justifyContent: justify(node.align),
        textAlign: (node.align ?? "left") as CSSProperties["textAlign"],
        fontFamily: FONT.family,
        fontSize: size,
        color,
        fontWeight: weight,
        lineHeight: 1.25,
        overflow: "hidden",
      }}
    >
      {node.content}
    </div>
  );
}

function ButtonContent({ node }: { node: ButtonNode }) {
  const variant = node.variant ?? "primary";
  const size = node.size ?? "md";
  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;
  const style: CSSProperties = {
    ...fill100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    fontFamily: FONT.family,
    fontSize,
    fontWeight: 600,
    textAlign: "center",
    padding: "0 12px",
    boxSizing: "border-box",
    overflow: "hidden",
  };
  if (variant === "primary") Object.assign(style, { background: PALETTE.primaryBg, color: PALETTE.primaryText });
  else if (variant === "secondary") Object.assign(style, { background: PALETTE.white, color: PALETTE.textHeading, border: `1px solid ${PALETTE.borderStrong}` });
  else Object.assign(style, { background: "transparent", color: PALETTE.textBody });
  return <div style={style}>{node.label}</div>;
}

function fieldBox(extra?: CSSProperties): CSSProperties {
  return {
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 6,
    background: PALETTE.white,
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    fontFamily: FONT.family,
    fontSize: 13,
    color: PALETTE.textFaint,
    boxSizing: "border-box",
    overflow: "hidden",
    ...extra,
  };
}

function InputContent({ node }: { node: InputNode }) {
  const placeholder = node.placeholder ?? (node.kind === "password" ? "••••••••" : "");
  const box = (
    <div style={fieldBox({ flex: node.label ? 1 : undefined, height: node.label ? undefined : "100%" })}>
      {node.kind === "search" && <Search size={14} color={PALETTE.textFaint} style={{ marginRight: 6, flexShrink: 0 }} />}
      <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{placeholder}</span>
    </div>
  );
  if (!node.label) return box;
  return (
    <div style={{ ...fill100, display: "flex", flexDirection: "column" }}>
      <FieldLabel text={node.label} />
      {box}
    </div>
  );
}

function TextareaContent({ node }: { node: TextareaNode }) {
  const box = (
    <div style={fieldBox({ flex: 1, alignItems: "flex-start", padding: "8px 10px" })}>
      <span style={{ overflow: "hidden" }}>{node.placeholder ?? ""}</span>
    </div>
  );
  return (
    <div style={{ ...fill100, display: "flex", flexDirection: "column" }}>
      {node.label && <FieldLabel text={node.label} />}
      {box}
    </div>
  );
}

function CheckboxContent({ node }: { node: CheckboxNode }) {
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT.family, overflow: "hidden" }}>
      <div style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${PALETTE.borderStrong}`, borderRadius: 4, background: node.checked ? PALETTE.primaryBg : PALETTE.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {node.checked && <Check size={12} color={PALETTE.white} strokeWidth={3} />}
      </div>
      {node.label && <span style={{ fontSize: 14, color: PALETTE.textBody, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</span>}
    </div>
  );
}

function RadioContent({ node }: { node: RadioNode }) {
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT.family, overflow: "hidden" }}>
      <div style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${PALETTE.borderStrong}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {node.checked && <div style={{ width: 9, height: 9, borderRadius: "50%", background: PALETTE.primaryBg }} />}
      </div>
      {node.label && <span style={{ fontSize: 14, color: PALETTE.textBody, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</span>}
    </div>
  );
}

function ToggleContent({ node }: { node: ToggleNode }) {
  const on = !!node.on;
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT.family, overflow: "hidden" }}>
      <div style={{ width: 36, height: 20, borderRadius: 999, background: on ? PALETTE.primaryBg : PALETTE.border, position: "relative", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: PALETTE.white, position: "absolute", top: 2, left: on ? 18 : 2 }} />
      </div>
      {node.label && <span style={{ fontSize: 14, color: PALETTE.textBody, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</span>}
    </div>
  );
}

function SelectContent({ node }: { node: SelectNode }) {
  const text = node.placeholder ?? node.options?.[0] ?? "Select";
  const box = (
    <div style={fieldBox({ justifyContent: "space-between", flex: node.label ? 1 : undefined, height: node.label ? undefined : "100%" })}>
      <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{text}</span>
      <ChevronDown size={16} color={PALETTE.textFaint} style={{ flexShrink: 0, marginLeft: 6 }} />
    </div>
  );
  if (!node.label) return box;
  return (
    <div style={{ ...fill100, display: "flex", flexDirection: "column" }}>
      <FieldLabel text={node.label} />
      {box}
    </div>
  );
}

function AvatarContent({ node }: { node: AvatarNode }) {
  const radius = node.shape === "square" ? 8 : "50%";
  return (
    <div style={{ ...fill100, borderRadius: radius, background: PALETTE.fill, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <User size={18} color={PALETTE.borderStrong} strokeWidth={1.75} />
    </div>
  );
}

function IconContent({ node }: { node: IconNode }) {
  const size = node.size ?? 24;
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <IconGlyph name={node.name} size={size} color={PALETTE.textBody} />
    </div>
  );
}

function DividerContent({ node }: { node: DividerNode }) {
  const vertical = node.orientation === "vertical";
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={vertical ? { width: 1, height: "100%", background: PALETTE.divider } : { height: 1, width: "100%", background: PALETTE.divider }} />
    </div>
  );
}

function BadgeContent({ node }: { node: BadgeNode }) {
  const tone = BADGE_TONES[node.tone ?? "neutral"] ?? BADGE_TONES.neutral;
  return (
    <div style={{ ...fill100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", maxWidth: "100%", height: "100%", padding: "0 8px", borderRadius: 999, background: tone.bg, color: tone.color, fontFamily: FONT.family, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {node.label}
      </span>
    </div>
  );
}
