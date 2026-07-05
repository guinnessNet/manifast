// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen as rtl, waitFor, fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import { ScreenRenderer } from "../src/web/components/wireframe/Renderer";
import { Board } from "../src/web/components/tasks/Board";
import { Roadmap } from "../src/web/components/plan/Roadmap";
import { DocView } from "../src/web/components/docs/DocView";
import { MapView } from "../src/web/components/diagram/MapView";
import { LinkChip } from "../src/web/components/LinkChip";
import { NavContext } from "../src/web/lib/nav";
import { buildLinkGraph } from "../src/web/lib/links";
import { NODE_TYPES, type Screen, type WireNode } from "../src/shared/schema/wireframe";
import type { FileResponse } from "../src/shared/types";
import { workspace, doc } from "./helpers";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear(); // reset persisted doc-tree collapse state between tests
});

/** Render inside the themed #mf-root wrapper (so dark-mode tokens apply). */
function renderThemed(ui: ReactElement, theme: "light" | "dark" = "dark") {
  return render(
    <div id="mf-root" data-theme={theme} data-accent="indigo">
      <NavContext.Provider value={() => {}}>{ui}</NavContext.Provider>
    </div>,
  );
}

describe("ScreenRenderer (18 node types)", () => {
  const sample: Record<string, Partial<WireNode>> = {
    Text: { content: "Hi" } as Partial<WireNode>,
    Button: { label: "Go" } as Partial<WireNode>,
    Icon: { name: "star" } as Partial<WireNode>,
    Badge: { label: "New" } as Partial<WireNode>,
    Table: { columns: ["A", "B"] } as Partial<WireNode>,
    Tabs: { tabs: ["One", "Two"] } as Partial<WireNode>,
  };
  const screenAll: Screen = {
    schema: "manifast.wireframe/1",
    id: "all",
    name: "All nodes",
    device: "desktop",
    size: { w: 1200, h: 2000 },
    root: NODE_TYPES.map((type, i) => ({
      id: `n-${type}`,
      type,
      frame: { x: 10, y: i * 60, w: 200, h: 48 },
      ...(type === "Box" ? { children: [] } : {}),
      ...sample[type],
    })) as unknown as WireNode[],
  };

  it("renders every one of the 18 node types in dark theme", () => {
    const { container } = renderThemed(<ScreenRenderer screen={screenAll} />);
    expect(container.querySelector("#mf-root")?.getAttribute("data-theme")).toBe("dark");
    for (const type of NODE_TYPES) {
      expect(container.querySelector(`[data-node-type="${type}"]`), `${type} should render`).not.toBeNull();
    }
  });
});

describe("Board", () => {
  const ws = workspace({
    tasks: {
      path: "t",
      ok: true,
      tasks: [
        { id: "t1", title: "Build login", status: "todo", priority: "high" },
        { id: "t2", title: "Wire API", status: "in_progress", priority: "med", deps: ["t1"] },
        { id: "t3", title: "Ship", status: "done", priority: "low" },
        { id: "t4", title: "Fix bug", status: "blocked", priority: "high" },
      ],
    },
  });

  it("renders the 4 columns and task titles", () => {
    renderThemed(<Board tasksData={ws.items.tasks} graph={buildLinkGraph(ws)} />);
    for (const col of ["To Do", "In Progress", "Done", "Blocked"]) {
      expect(rtl.getByText(col)).toBeInTheDocument();
    }
    // "Build login" appears both as t1's card and as t2's dependency chip.
    expect(rtl.getAllByText("Build login").length).toBeGreaterThanOrEqual(1);
    expect(rtl.getByText("Ship")).toBeInTheDocument();
  });
});

describe("Roadmap", () => {
  const ws = workspace({
    tasks: { path: "t", ok: true, tasks: [{ id: "t1", title: "A", status: "done", priority: "med" }] },
    plan: {
      path: "p",
      ok: true,
      phases: [
        { id: "p1", name: "MVP", status: "active", taskIds: ["t1"] },
        { id: "p2", name: "Dashboard", status: "planned", taskIds: [] },
      ],
    },
  });

  it("renders phase names and a progress count", () => {
    const { container } = renderThemed(<Roadmap planData={ws.items.plan} graph={buildLinkGraph(ws)} />);
    expect(rtl.getByText("MVP")).toBeInTheDocument();
    expect(rtl.getByText("Dashboard")).toBeInTheDocument();
    expect(container.textContent).toMatch(/\d+\/\d+ done/);
  });
});

describe("LinkChip", () => {
  it("greys a broken link and marks a valid one clickable", () => {
    const { container: broken } = renderThemed(
      <LinkChip target={{ kind: "task", id: "ghost" }} exists={false} label="ghost" />,
    );
    expect(broken.querySelector("#mf-root")!.innerHTML).toContain("line-through");

    cleanup();
    renderThemed(<LinkChip target={{ kind: "task", id: "t1" }} exists label="ok" />);
    expect(rtl.getByRole("button")).toBeInTheDocument();
  });
});

describe("MapView", () => {
  it("renders the auto project map with node labels", () => {
    const ws = workspace({ docs: [doc({ id: "a", related: ["b"] }), doc({ id: "b", title: "Beta doc" })] });
    renderThemed(<MapView data={ws} tick={0} />);
    expect(rtl.getAllByText("Beta doc").length).toBeGreaterThan(0);
  });
});

describe("DocRail folder tree", () => {
  const docs = [
    doc({ id: "a", path: "docs/specs/claim/CLAIM_BUILD_V1.md", title: "Claim build" }),
    doc({ id: "b", path: "docs/specs/claim/CLAIM_AUDIT_V1.md", title: "Claim audit" }),
    doc({ id: "c", path: "docs/specs/ENVELOPE_V1.md", title: "Envelope" }),
    doc({ id: "r", path: "README.md", title: "Readme" }),
  ];
  const ws = workspace({ docs });

  // path is undefined → useFile makes no request, so the rail renders fetch-free.
  const renderRail = () => renderThemed(<DocView docs={docs} onSelect={() => {}} graph={buildLinkGraph(ws)} tick={0} />);

  it("nests docs into collapsible folders with recursive count badges", () => {
    renderRail();
    const claim = rtl.getByRole("button", { name: /^claim folder/ });
    expect(claim).toHaveAttribute("aria-expanded", "true");
    expect(claim.getAttribute("aria-label")).toMatch(/2 docs/); // claim holds a + b
    expect(rtl.getByText("Claim build")).toBeInTheDocument();
    expect(rtl.getByText("Readme")).toBeInTheDocument(); // root-level file at top level
  });

  it("collapsing a folder hides its descendants", () => {
    renderRail();
    expect(rtl.getByText("Claim build")).toBeInTheDocument();
    fireEvent.click(rtl.getByRole("button", { name: /^docs folder/ }));
    expect(rtl.queryByText("Claim build")).not.toBeInTheDocument();
    expect(rtl.queryByRole("button", { name: /^claim folder/ })).not.toBeInTheDocument();
  });

  it("search auto-expands folders containing matches", () => {
    renderRail();
    fireEvent.click(rtl.getByRole("button", { name: "Collapse all" })); // collapse everything
    expect(rtl.queryByText("Claim build")).not.toBeInTheDocument();
    fireEvent.change(rtl.getByPlaceholderText(/^Search docs…/), { target: { value: "claim build" } });
    expect(rtl.getByText("Claim build")).toBeInTheDocument(); // surfaced despite being collapsed
    // During search folders are static headers (no toggle button) so a click
    // can't silently mutate the persisted collapse state behind the auto-expand.
    expect(rtl.queryByRole("button", { name: /folder/ })).toBeNull();
  });
});

describe("DocView (data fetched via stubbed fetch)", () => {
  it("renders the markdown body for the selected doc in dark theme", async () => {
    const fileResp: FileResponse = {
      kind: "doc",
      path: "docs/guide.md",
      frontmatter: { title: "Guide", status: "active" },
      markdown: "# Guide\n\nThe **body** content renders here.",
      ok: true,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fileResp), { status: 200, headers: { "content-type": "application/json" } })),
    );

    const meta = doc({ id: "guide", title: "Guide", path: "docs/guide.md", status: "active" });
    const ws = workspace({ docs: [meta] });
    renderThemed(
      <DocView docs={[meta]} path="docs/guide.md" onSelect={() => {}} meta={meta} graph={buildLinkGraph(ws)} tick={0} />,
    );

    await waitFor(() => expect(rtl.getByText(/body/)).toBeInTheDocument());
    expect(rtl.getAllByText(/Guide/).length).toBeGreaterThan(0);
  });
});
