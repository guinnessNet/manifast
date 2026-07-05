import type { CSSProperties, Ref } from "react";
import type { Screen, WireNode, BoxNode } from "@shared/schema/wireframe";
import { PALETTE, FONT } from "./palette";
import { LeafContent } from "./nodes";

// card/section clip their children: full-bleed images respect the rounded
// corners, and an agent's frame-math mistake stays inside one card instead of
// bleeding across the screen. `plain` stays unclipped (pure grouping).
function boxSurface(variant?: string): CSSProperties {
  if (variant === "card")
    return {
      background: PALETTE.cardBg,
      border: `1px solid ${PALETTE.cardBorder}`,
      borderRadius: 10,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      overflow: "hidden",
    };
  if (variant === "section")
    return { background: PALETTE.sectionBg, borderRadius: 8, overflow: "hidden" };
  return {}; // plain: grouping only, no surface
}

export function NodeView({ node }: { node: WireNode }) {
  const base: CSSProperties = {
    position: "absolute",
    left: node.frame.x,
    top: node.frame.y,
    width: node.frame.w,
    height: node.frame.h,
    boxSizing: "border-box",
  };

  if (node.type === "Box") {
    const box = node as BoxNode;
    return (
      <div style={{ ...base, ...boxSurface(box.variant) }} data-node-type="Box" data-node-id={box.id}>
        {box.children.map((c) => (
          <NodeView key={c.id} node={c} />
        ))}
      </div>
    );
  }

  return (
    <div style={base} data-node-type={node.type} data-node-id={node.id}>
      <LeafContent node={node} />
    </div>
  );
}

export function ScreenRenderer({ screen, innerRef }: { screen: Screen; innerRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      data-screen={screen.id}
      style={{
        position: "relative",
        width: screen.size.w,
        height: screen.size.h,
        background: screen.background ?? PALETTE.white,
        overflow: "hidden",
        fontFamily: FONT.family,
      }}
    >
      {screen.root.map((n) => (
        <NodeView key={n.id} node={n} />
      ))}
    </div>
  );
}
