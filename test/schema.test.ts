import { describe, it, expect } from "vitest";
import {
  WireframeSchema,
  WireNodeSchema,
  NODE_TYPES,
  TasksFileSchema,
  PlanFileSchema,
  DOC_TYPES,
  DocFrontmatterSchema,
  ManifestSchema,
  DiagramFileSchema,
} from "../src/shared/schema/index";

describe("wireframe schema", () => {
  const validScreen = {
    schema: "manifast.wireframe/1",
    id: "login",
    name: "Login",
    device: "desktop",
    size: { w: 1280, h: 800 },
    root: [
      { id: "t1", type: "Text", content: "Hello", frame: { x: 0, y: 0, w: 100, h: 20 } },
    ],
  };

  it("accepts a valid screen", () => {
    expect(WireframeSchema.safeParse(validScreen).success).toBe(true);
  });

  it("rejects a wrong schema literal", () => {
    expect(WireframeSchema.safeParse({ ...validScreen, schema: "nope" }).success).toBe(false);
  });

  it("rejects an unknown device", () => {
    expect(WireframeSchema.safeParse({ ...validScreen, device: "watch" }).success).toBe(false);
  });

  it("rejects an unknown node type via the discriminated union", () => {
    const r = WireframeSchema.safeParse({
      ...validScreen,
      root: [{ id: "x", type: "Blob", frame: { x: 0, y: 0, w: 1, h: 1 } }],
    });
    expect(r.success).toBe(false);
  });

  it("parses Box.children recursively and defaults children to []", () => {
    const box = {
      id: "b",
      type: "Box",
      frame: { x: 0, y: 0, w: 10, h: 10 },
      children: [
        {
          id: "b2",
          type: "Box",
          frame: { x: 0, y: 0, w: 5, h: 5 },
          children: [{ id: "t", type: "Text", content: "deep", frame: { x: 0, y: 0, w: 1, h: 1 } }],
        },
      ],
    };
    const r = WireNodeSchema.safeParse(box);
    expect(r.success).toBe(true);

    const bare = WireNodeSchema.safeParse({ id: "b", type: "Box", frame: { x: 0, y: 0, w: 1, h: 1 } });
    expect(bare.success).toBe(true);
    if (bare.success) expect((bare.data as { children: unknown[] }).children).toEqual([]);
  });

  it("has all 18 node types in the catalog and each parses", () => {
    expect(NODE_TYPES).toHaveLength(18);
    const frame = { x: 0, y: 0, w: 10, h: 10 };
    const samples: Record<string, Record<string, unknown>> = {
      Box: {},
      Text: { content: "x" },
      Button: { label: "x" },
      Input: {},
      Textarea: {},
      Checkbox: {},
      Radio: {},
      Toggle: {},
      Select: {},
      Image: {},
      Avatar: {},
      Icon: { name: "star" },
      Divider: {},
      Badge: { label: "x" },
      Navbar: {},
      Table: { columns: ["a"] },
      List: {},
      Tabs: { tabs: ["a", "b"] },
    };
    for (const type of NODE_TYPES) {
      const r = WireNodeSchema.safeParse({ id: type, type, frame, ...samples[type] });
      expect(r.success, `${type} should parse`).toBe(true);
    }
  });
});

describe("doc frontmatter schema", () => {
  const base = { schema: "manifast.doc/1", id: "d1", type: "spec", title: "Spec 1" };

  it("applies the default status of draft", () => {
    const r = DocFrontmatterSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("draft");
  });

  it("parses the new related + sources arrays", () => {
    const r = DocFrontmatterSchema.safeParse({ ...base, related: ["a", "b"], sources: ["src/x.ts"] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.related).toEqual(["a", "b"]);
      expect(r.data.sources).toEqual(["src/x.ts"]);
    }
  });

  it("accepts every first-class doc type documented by the skill", () => {
    for (const type of DOC_TYPES) {
      const r = DocFrontmatterSchema.safeParse({ ...base, type });
      expect(r.success, `${type} should parse`).toBe(true);
    }
  });

  it("rejects an unknown doc type", () => {
    expect(DocFrontmatterSchema.safeParse({ ...base, type: "blogpost" }).success).toBe(false);
  });

  it("rejects related when it is not an array of strings", () => {
    expect(DocFrontmatterSchema.safeParse({ ...base, related: [1, 2] }).success).toBe(false);
  });

  it("requires the manifast.doc/1 schema literal", () => {
    expect(DocFrontmatterSchema.safeParse({ ...base, schema: "other" }).success).toBe(false);
  });
});

describe("tasks schema", () => {
  it("accepts valid tasks and defaults priority to med", () => {
    const r = TasksFileSchema.safeParse({
      schema: "manifast.tasks/1",
      tasks: [{ id: "t1", title: "A", status: "todo" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tasks[0].priority).toBe("med");
  });

  it("rejects an invalid status", () => {
    const r = TasksFileSchema.safeParse({
      schema: "manifast.tasks/1",
      tasks: [{ id: "t1", title: "A", status: "wip" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("plan schema", () => {
  it("accepts a valid plan and defaults phase status to planned", () => {
    const r = PlanFileSchema.safeParse({
      schema: "manifast.plan/1",
      phases: [{ id: "p1", name: "Phase 1" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phases[0].status).toBe("planned");
  });
});

describe("manifest schema", () => {
  it("accepts a minimal manifest", () => {
    const r = ManifestSchema.safeParse({ schema: "manifast/1", project: { name: "demo" } });
    expect(r.success).toBe(true);
  });

  it("accepts optional sources config", () => {
    const r = ManifestSchema.safeParse({
      schema: "manifast/1",
      project: { name: "demo" },
      sources: { docs: ["docs", "notes"], exclude: ["docs/archive"] },
    });
    expect(r.success).toBe(true);
  });
});

describe("diagram schema", () => {
  const valid = {
    schema: "manifast.diagram/1",
    id: "arch",
    title: "Architecture",
    nodes: [{ id: "a", label: "A" }],
    edges: [{ from: "a", to: "a" }],
  };

  it("accepts a valid diagram and defaults kind to diagram", () => {
    const r = DiagramFileSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe("diagram");
  });

  it("accepts node refs with the allowed kinds", () => {
    const r = DiagramFileSchema.safeParse({
      ...valid,
      nodes: [{ id: "a", label: "A", ref: { kind: "path", id: "src/x.ts" } }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid direction", () => {
    expect(DiagramFileSchema.safeParse({ ...valid, direction: "DIAGONAL" }).success).toBe(false);
  });
});
