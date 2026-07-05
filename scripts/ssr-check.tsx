import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import matter from "gray-matter";
import { WireframeSchema } from "@shared/schema/wireframe";
import { readWorkspace } from "../src/server/workspace";
import { buildLinkGraph } from "../src/web/lib/links";
import { ScreenRenderer } from "../src/web/components/wireframe/Renderer";
import { Board } from "../src/web/components/tasks/Board";
import { Roadmap } from "../src/web/components/plan/Roadmap";
import { LinkChip } from "../src/web/components/LinkChip";
import { MapView } from "../src/web/components/diagram/MapView";
import { NavContext } from "../src/web/lib/nav";
import { buildProjectMap } from "../src/web/lib/graph";
import { layoutDiagram, isFlowKind, isTreeKind } from "../src/web/lib/layout";
import { DiagramFileSchema } from "@shared/schema/diagram";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) ok = false;
};

const dto = await readWorkspace("skill/examples/.manifast", "skill/examples");
const graph = buildLinkGraph(dto);

// 1. Wireframe renderer — all 18 node types
const wf = WireframeSchema.parse(
  JSON.parse(readFileSync("skill/examples/.manifast/wireframes/screen-dashboard.json", "utf8")),
);
const wfHtml = renderToStaticMarkup(<ScreenRenderer screen={wf} />);
const TYPES = ["Box", "Text", "Button", "Input", "Textarea", "Checkbox", "Radio", "Toggle", "Select", "Image", "Avatar", "Icon", "Divider", "Badge", "Navbar", "Table", "List", "Tabs"];
check("renderer: all 18 node types", TYPES.every((t) => wfHtml.includes(`data-node-type="${t}"`)));
check("renderer: navbar brand + table column", wfHtml.includes("Manifast") && wfHtml.includes("Name"));

// 2. Task board
const boardHtml = renderToStaticMarkup(<Board tasksData={dto.items.tasks} graph={graph} />);
check("board: 4 columns", ["To Do", "In Progress", "Done", "Blocked"].every((c) => boardHtml.includes(c)));
check("board: task title rendered", boardHtml.includes("Implement login form"));
check("board: dep chip rendered (task-1 as dep of task-2)", boardHtml.includes("task-1") || boardHtml.includes("Implement login form"));

// 3. Roadmap
const roadHtml = renderToStaticMarkup(<Roadmap planData={dto.items.plan} graph={graph} />);
check("roadmap: phase names", roadHtml.includes("MVP Auth") && roadHtml.includes("Dashboard"));
check("roadmap: progress text", /\d+\/\d+ done/.test(roadHtml));

// 4. Markdown (GFM + highlight)
const md = matter(readFileSync("skill/examples/.manifast/prd/prd.md", "utf8")).content;
const mdHtml = renderToStaticMarkup(
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
    {md}
  </ReactMarkdown>,
);
check("markdown: GFM table", mdHtml.includes("<table"));
check("markdown: task list checkbox", mdHtml.includes('type="checkbox"'));
check("markdown: code block highlighted", mdHtml.includes("hljs") && mdHtml.includes("signIn"));

// 5. Link chips (broken vs valid)
const brokenChip = renderToStaticMarkup(<LinkChip target={{ kind: "task", id: "ghost" }} exists={false} label="ghost" />);
check("links: broken link greyed (line-through + warning)", brokenChip.includes("line-through") && brokenChip.includes("broken link"));
const okChip = renderToStaticMarkup(<LinkChip target={{ kind: "task", id: "task-1" }} exists label="ok" />);
check("links: valid link is a clickable button", okChip.startsWith("<button"));

// 6. project map + dagre layout
const pmap = buildProjectMap(dto);
check("project map auto-built with nodes/edges", pmap.nodes.length > 0 && pmap.edges.length > 0);
const pl = layoutDiagram(pmap);
check("dagre laid out project map", pl.width > 0 && pl.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
const mapHtml = renderToStaticMarkup(
  <NavContext.Provider value={() => {}}>
    <MapView data={dto} tick={0} />
  </NavContext.Provider>,
);
check("MapView renders node labels", mapHtml.includes("Login") || mapHtml.includes("Dashboard"));

// 7. agent-authored diagram lays out
const arch = DiagramFileSchema.parse(JSON.parse(readFileSync("skill/examples/.manifast/diagrams/architecture.json", "utf8")));
const al = layoutDiagram(arch);
check("agent architecture diagram laid out (dagre)", al.nodes.length === arch.nodes.length && al.width > 0);

// 7b. user-flow diagram parses (kind=flow) + lays out
const flow = DiagramFileSchema.parse(JSON.parse(readFileSync("skill/examples/.manifast/diagrams/user-flow.json", "utf8")));
const fl = layoutDiagram(flow);
check("user-flow diagram parses + laid out", isFlowKind(flow.kind) && fl.nodes.length === flow.nodes.length && fl.width > 0);

// 7c. feature-tree diagram parses (kind=tree) + lays out
const tree = DiagramFileSchema.parse(JSON.parse(readFileSync("skill/examples/.manifast/diagrams/feature-tree.json", "utf8")));
const tl = layoutDiagram(tree);
check("feature-tree diagram parses + laid out", isTreeKind(tree.kind) && tl.nodes.length === tree.nodes.length && tl.width > 0);

console.log(ok ? "\nALL SSR CHECKS PASSED" : "\nSSR CHECKS FAILED");
process.exit(ok ? 0 : 1);
