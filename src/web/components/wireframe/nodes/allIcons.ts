// The FULL lucide registry (~1,500 icons), isolated in its own module so Vite
// code-splits it out of the main bundle. It loads lazily the first time a
// wireframe references an icon outside the curated set in ./index.tsx —
// agents may pick any lucide name and it will render instead of a placeholder.
import { icons } from "lucide-react";
export default icons;
