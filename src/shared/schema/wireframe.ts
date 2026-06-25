import { z } from "zod";

export const DeviceSchema = z.enum(["desktop", "tablet", "mobile"]);
export type Device = z.infer<typeof DeviceSchema>;

export const FrameSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Frame = z.infer<typeof FrameSchema>;

const base = {
  id: z.string(),
  name: z.string().optional(),
  frame: FrameSchema,
};

// --- Leaf nodes (17) -------------------------------------------------------

export const TextNodeSchema = z.object({
  ...base,
  type: z.literal("Text"),
  content: z.string(),
  role: z.enum(["h1", "h2", "h3", "body", "caption", "label"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export const ButtonNodeSchema = z.object({
  ...base,
  type: z.literal("Button"),
  label: z.string(),
  variant: z.enum(["primary", "secondary", "ghost"]).optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

export const InputNodeSchema = z.object({
  ...base,
  type: z.literal("Input"),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  kind: z.enum(["text", "search", "password", "email", "number"]).optional(),
});

export const TextareaNodeSchema = z.object({
  ...base,
  type: z.literal("Textarea"),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  rows: z.number().optional(),
});

export const CheckboxNodeSchema = z.object({
  ...base,
  type: z.literal("Checkbox"),
  label: z.string().optional(),
  checked: z.boolean().optional(),
});

export const RadioNodeSchema = z.object({
  ...base,
  type: z.literal("Radio"),
  label: z.string().optional(),
  checked: z.boolean().optional(),
});

export const ToggleNodeSchema = z.object({
  ...base,
  type: z.literal("Toggle"),
  label: z.string().optional(),
  on: z.boolean().optional(),
});

export const SelectNodeSchema = z.object({
  ...base,
  type: z.literal("Select"),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const ImageNodeSchema = z.object({
  ...base,
  type: z.literal("Image"),
  ratio: z.string().optional(),
  label: z.string().optional(),
});

export const AvatarNodeSchema = z.object({
  ...base,
  type: z.literal("Avatar"),
  shape: z.enum(["circle", "square"]).optional(),
});

export const IconNodeSchema = z.object({
  ...base,
  type: z.literal("Icon"),
  name: z.string(),
  size: z.number().optional(),
});

export const DividerNodeSchema = z.object({
  ...base,
  type: z.literal("Divider"),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
});

export const BadgeNodeSchema = z.object({
  ...base,
  type: z.literal("Badge"),
  label: z.string(),
  tone: z.enum(["neutral", "info", "success", "warning", "danger"]).optional(),
});

export const NavbarNodeSchema = z.object({
  ...base,
  type: z.literal("Navbar"),
  brand: z.string().optional(),
  links: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
});

export const TableNodeSchema = z.object({
  ...base,
  type: z.literal("Table"),
  columns: z.array(z.string()),
  rows: z.number().optional(),
});

export const ListNodeSchema = z.object({
  ...base,
  type: z.literal("List"),
  items: z.number().optional(),
  withAvatar: z.boolean().optional(),
  withIcon: z.boolean().optional(),
});

export const TabsNodeSchema = z.object({
  ...base,
  type: z.literal("Tabs"),
  tabs: z.array(z.string()),
  activeIndex: z.number().optional(),
});

// --- Leaf TS types ---------------------------------------------------------

export type TextNode = z.infer<typeof TextNodeSchema>;
export type ButtonNode = z.infer<typeof ButtonNodeSchema>;
export type InputNode = z.infer<typeof InputNodeSchema>;
export type TextareaNode = z.infer<typeof TextareaNodeSchema>;
export type CheckboxNode = z.infer<typeof CheckboxNodeSchema>;
export type RadioNode = z.infer<typeof RadioNodeSchema>;
export type ToggleNode = z.infer<typeof ToggleNodeSchema>;
export type SelectNode = z.infer<typeof SelectNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type AvatarNode = z.infer<typeof AvatarNodeSchema>;
export type IconNode = z.infer<typeof IconNodeSchema>;
export type DividerNode = z.infer<typeof DividerNodeSchema>;
export type BadgeNode = z.infer<typeof BadgeNodeSchema>;
export type NavbarNode = z.infer<typeof NavbarNodeSchema>;
export type TableNode = z.infer<typeof TableNodeSchema>;
export type ListNode = z.infer<typeof ListNodeSchema>;
export type TabsNode = z.infer<typeof TabsNodeSchema>;

// --- Box (the only container) + recursive union ----------------------------

export interface BoxNode {
  id: string;
  name?: string;
  frame: Frame;
  type: "Box";
  variant?: "card" | "section" | "plain";
  children: WireNode[];
}

export type WireNode =
  | BoxNode
  | TextNode
  | ButtonNode
  | InputNode
  | TextareaNode
  | CheckboxNode
  | RadioNode
  | ToggleNode
  | SelectNode
  | ImageNode
  | AvatarNode
  | IconNode
  | DividerNode
  | BadgeNode
  | NavbarNode
  | TableNode
  | ListNode
  | TabsNode;

export const BoxNodeSchema = z.object({
  ...base,
  type: z.literal("Box"),
  variant: z.enum(["card", "section", "plain"]).optional(),
  children: z
    .array(z.lazy((): z.ZodType<WireNode> => WireNodeSchema))
    .optional()
    .default([]),
});

export const WireNodeSchema: z.ZodType<WireNode> = z.discriminatedUnion("type", [
  BoxNodeSchema,
  TextNodeSchema,
  ButtonNodeSchema,
  InputNodeSchema,
  TextareaNodeSchema,
  CheckboxNodeSchema,
  RadioNodeSchema,
  ToggleNodeSchema,
  SelectNodeSchema,
  ImageNodeSchema,
  AvatarNodeSchema,
  IconNodeSchema,
  DividerNodeSchema,
  BadgeNodeSchema,
  NavbarNodeSchema,
  TableNodeSchema,
  ListNodeSchema,
  TabsNodeSchema,
]) as unknown as z.ZodType<WireNode>;

// --- Screen (wireframe file) ----------------------------------------------

export const WireframeSchema = z.object({
  schema: z.literal("manifast.wireframe/1"),
  id: z.string(),
  name: z.string(),
  device: DeviceSchema,
  size: z.object({ w: z.number(), h: z.number() }),
  background: z.string().optional(),
  root: z.array(WireNodeSchema),
});
export type Screen = z.infer<typeof WireframeSchema>;

/** The fixed catalog of node types (18). */
export const NODE_TYPES = [
  "Box",
  "Text",
  "Button",
  "Input",
  "Textarea",
  "Checkbox",
  "Radio",
  "Toggle",
  "Select",
  "Image",
  "Avatar",
  "Icon",
  "Divider",
  "Badge",
  "Navbar",
  "Table",
  "List",
  "Tabs",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];
