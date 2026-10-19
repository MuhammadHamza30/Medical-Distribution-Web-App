import { readFile, writeFile } from "node:fs/promises";
const html = await readFile("dist/index.html", "utf8");
const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!script || !stylesheet)
  throw Error("Expected one JavaScript entry and stylesheet.");
const js = await readFile("dist/" + script[1].replace(/^\.\//, ""), "utf8");
let css = await readFile("dist/" + stylesheet[1].replace(/^\.\//, ""), "utf8");
// Offline preview uses native font fallbacks. Vite dev source can load optional web fonts.
css = css.replace(/@import[^;]+;/g, "");
const output = html
  .replace(
    script[0],
    () =>
      '<script type="module">' +
      js.replace(/<\/script/gi, "<\\/script") +
      "</script>",
  )
  .replace(stylesheet[0], () => "<style>" + css + "</style>");
await writeFile("PharmaFlow_Preview.html", output);
console.log("Created standalone offline preview: PharmaFlow_Preview.html");
