import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function versionarPwa(pastaPublica) {
  const assets = (await readdir(resolve(pastaPublica, "assets"))).sort();
  const versao = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 16);
  const caminho = resolve(pastaPublica, "OneSignalSDKWorker.js");
  const fonte = (await readFile(caminho, "utf8")).replace(/^\/\/ ObrasFlow build: .+\r?\n/, "");
  await writeFile(caminho, `// ObrasFlow build: ${versao}\n${fonte}`);
  return versao;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const versao = await versionarPwa(fileURLToPath(new URL("../.output/public/", import.meta.url)));
  console.log(`[build] Versão do PWA: ${versao}`);
}
