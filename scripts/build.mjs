#!/usr/bin/env node
/**
 * Build do On This Day.
 *
 *   npm run build            Release: sobe a versão (patch), compila e grava index.js + style.css + manifest.json
 *                            na raiz do projeto (são os arquivos que vão para o GitHub).
 *   npm run build:minor      idem, subindo a versão "minor" (1.0.5 -> 1.1.0)
 *   npm run build:major      idem, subindo a versão "major" (1.4.0 -> 2.0.0)
 *   npm run build:keep       Release sem mexer na versão
 *   npm run local            Build de TESTE (catálogo local, pasta dist/, sem subir versão) e instala no Spicetify
 *   npm run local:build      Só compila o build de teste em dist/
 *
 * A versão fica em package.json; o build copia para manifest.json, package-lock.json e para dentro do app
 * (é o número que aparece no canto superior direito).
 */
import { build, context } from "esbuild";
import { copyFile, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };

const isLocal = has("--local");
const watch = has("--watch");
const bumpKind = isLocal || has("--no-bump") ? "none" : (valueOf("--bump") ?? "patch");
const outDir = isLocal ? join(root, "dist") : root;
const APP_FOLDER = "on-this-day";

/* ------------------------------ helpers ------------------------------ */

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = (file, data) => writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
const exists = (file) => access(file).then(() => true, () => false);

function bump(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? "");
  if (!match) throw new Error(`Versão inválida em package.json: "${version}"`);
  let [major, minor, patch] = match.slice(1).map(Number);
  if (kind === "none") return `${major}.${minor}.${patch}`;
  if (kind === "major") { major += 1; minor = 0; patch = 0; }
  else if (kind === "minor") { minor += 1; patch = 0; }
  else if (kind === "patch") { patch += 1; }
  else throw new Error(`Tipo de versão desconhecido: ${kind} (use patch, minor ou major)`);
  return `${major}.${minor}.${patch}`;
}

function repositorySlug(pkg) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url ?? "";
  return /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url)?.[1] ?? null;
}

function pagesRoot(slug) {
  const [owner, name] = slug.split("/");
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner.toLowerCase()}.github.io`
    : `https://${owner.toLowerCase()}.github.io/${name}`;
}

/* ------------------------------ versão ------------------------------ */

const pkgPath = join(root, "package.json");
const manifestPath = join(root, "manifest.json");
const lockPath = join(root, "package-lock.json");

const pkg = await readJson(pkgPath);
const slug = repositorySlug(pkg);
if (!slug) throw new Error('Defina "repository" em package.json (ex.: https://github.com/usuario/on-this-day.git).');

const previousVersion = pkg.version;
const version = bump(previousVersion, bumpKind);

if (bumpKind !== "none" && !watch) {
  pkg.version = version;
  await writeJson(pkgPath, pkg);
  const manifest = await readJson(manifestPath);
  manifest.version = version;
  await writeJson(manifestPath, manifest);
  if (await exists(lockPath)) {
    const lock = await readJson(lockPath);
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
    await writeJson(lockPath, lock);
  }
} else {
  // Sem bump: o manifest só é corrigido se estiver fora de sincronia com o package.json.
  const manifest = await readJson(manifestPath);
  if (manifest.version !== version) {
    manifest.version = version;
    await writeJson(manifestPath, manifest);
  }
}

/* ----------------------------- typecheck ----------------------------- */

if (!isLocal && !has("--skip-typecheck")) {
  try {
    const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
    execFileSync(process.execPath, [tsc, "--noEmit", "-p", root], { stdio: "inherit" });
  } catch (error) {
    if (error?.code === "MODULE_NOT_FOUND") console.warn("⚠ TypeScript não instalado; pulando a checagem de tipos (rode npm install).");
    else {
      // O build não fica com a versão "gasta" se a checagem falhar.
      if (bumpKind !== "none") {
        pkg.version = previousVersion;
        await writeJson(pkgPath, pkg);
        const manifest = await readJson(manifestPath);
        manifest.version = previousVersion;
        await writeJson(manifestPath, manifest);
        if (await exists(lockPath)) {
          const lock = await readJson(lockPath);
          lock.version = previousVersion;
          if (lock.packages?.[""]) lock.packages[""].version = previousVersion;
          await writeJson(lockPath, lock);
        }
      }
      console.error("\n✖ Erros de TypeScript: build cancelado e versão mantida em", previousVersion);
      process.exit(1);
    }
  }
}

/* ------------------------------- build ------------------------------- */

const catalogBaseUrl = (process.env.OTD_CATALOG_BASE_URL?.trim()
  || (isLocal ? "http://127.0.0.1:18767/catalog" : `${pagesRoot(slug)}/catalog`)).replace(/\/$/, "");

const banner = [
  `/* On This Day v${version} — https://github.com/${slug}`,
  ` * Bundle legível (sem minificação), gerado a partir do código-fonte do projeto.`,
  ` * Roda dentro do Spotify via Spicetify; consulta só: Spotify (sessão local), MusicBrainz/Cover Art Archive (catálogo),`,
  ` * GitHub (verificação de nova versão). Sem coleta de dados e sem credenciais. */`,
].join("\n");

const options = {
  entryPoints: [join(root, "src", "index.tsx")],
  outfile: join(outDir, "index.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsxFactory: "Spicetify.React.createElement",
  jsxFragment: "Spicetify.React.Fragment",
  sourcemap: false,
  minify: false,
  charset: "utf8",
  legalComments: "none",
  banner: { js: banner },
  loader: { ".css": "text" },
  define: {
    "process.env.NODE_ENV": '"production"',
    __OTD_CATALOG_BASE_URL__: JSON.stringify(catalogBaseUrl),
    __OTD_VERSION__: JSON.stringify(version),
    __OTD_REPO__: JSON.stringify(slug),
  },
};

async function copyAssets() {
  await copyFile(join(root, "src", "styles", "on-this-day.css"), join(outDir, "style.css"));
  if (outDir !== root) await copyFile(manifestPath, join(outDir, "manifest.json"));
}

await mkdir(outDir, { recursive: true });

if (watch) {
  const ctx = await context(options);
  await ctx.rebuild();
  await copyAssets();
  await ctx.watch();
  console.log(`Observando alterações… (v${version}, catálogo ${catalogBaseUrl})`);
} else {
  await build(options);
  await copyAssets();
  const bumped = bumpKind !== "none" ? `${previousVersion} → ${version}` : version;
  console.log(`✔ On This Day ${isLocal ? "(build local de teste)" : "(release)"}  versão ${bumped}`);
  console.log(`  saída:   ${isLocal ? "dist/" : "index.js, style.css, manifest.json (raiz)"}`);
  console.log(`  catálogo: ${catalogBaseUrl}`);
}

/* ------------------------ instalação local (Spicetify) ------------------------ */

if (has("--install") && !watch) {
  const run = (args) => execFileSync("spicetify", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  let userData;
  try {
    userData = run(["path", "userdata"]).trim().split(/\r?\n/).pop();
  } catch {
    userData = process.platform === "win32" ? join(process.env.APPDATA ?? join(os.homedir(), "AppData", "Roaming"), "spicetify") : join(process.env.XDG_CONFIG_HOME ?? join(os.homedir(), ".config"), "spicetify");
  }
  const target = join(userData, "CustomApps", APP_FOLDER);
  await mkdir(target, { recursive: true });
  for (const file of ["manifest.json", "index.js", "style.css"]) await copyFile(join(outDir, file), join(target, file));
  console.log(`  instalado em: ${target}`);
  if (!has("--no-apply")) {
    try {
      run(["config", "custom_apps", APP_FOLDER]);
      console.log(run(["apply"]).trim().split(/\r?\n/).slice(-2).join("\n"));
    } catch (error) {
      console.error("⚠ Arquivos copiados, mas o Spicetify não respondeu. Rode manualmente: spicetify config custom_apps on-this-day && spicetify apply");
      console.error(String(error.stderr ?? error.message).trim());
      process.exitCode = 1;
    }
  }
}
