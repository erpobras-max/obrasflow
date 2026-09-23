import { readFile, writeFile } from "node:fs/promises";

const outputFile = new URL("../.output/server/index.mjs", import.meta.url);

const replacements = [
  {
    from: "return mod.fetch(req);",
    to: "return mod.fetch(req, globalThis.__env__);",
  },
  {
    from: "return promise.then((mod2) => mod2.fetch(req));",
    to: "return promise.then((mod2) => mod2.fetch(req, globalThis.__env__));",
  },
];

let source = await readFile(outputFile, "utf8");

for (const { from, to } of replacements) {
  const occurrences = source.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Não foi possível corrigir a ponte de ambiente do Nitro: esperado 1 trecho ${JSON.stringify(from)}, encontrado ${occurrences}.`,
    );
  }
  source = source.replace(from, to);
}

await writeFile(outputFile, source, "utf8");
console.log("[build] Bindings do Cloudflare encaminhados ao serviço SSR do Nitro.");
