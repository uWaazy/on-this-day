#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// OTD_CATALOG_DIR permite apontar para outra pasta (útil em testes); o padrão é data/site/catalog.
const root = process.env.OTD_CATALOG_DIR
  ? path.resolve(process.env.OTD_CATALOG_DIR)
  : path.join(projectRoot, "data/site/catalog");
const host = "127.0.0.1";
const port = Number(process.env.OTD_CATALOG_PORT ?? 18767);

http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "*");
  response.setHeader("Access-Control-Allow-Private-Network", "true");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405).end("Method not allowed");
    return;
  }

  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`).pathname;
  // /catalog/MM-DD.json (álbuns) e /catalog/birthdays/MM-DD.json (aniversários de artistas)
  const match = /^\/catalog\/(birthdays\/)?(\d{2}-\d{2})\.json$/.exec(pathname);
  if (!match) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const body = await fs.readFile(path.join(root, match[1] ? "birthdays" : "", `${match[2]}.json`));
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }).end(body);
  } catch (error) {
    const missing = error?.code === "ENOENT";
    response.writeHead(missing ? 404 : 500).end(
      missing
        ? match[1] ? "Birthdays not generated (run: npm run catalog:birthdays)" : "Catalog not generated"
        : "Catalog read error",
    );
  }
}).listen(port, host, () => {
  console.log(`MusicBrainz catalog: http://${host}:${port}/catalog/MM-DD.json`);
  console.log(`Artist birthdays:    http://${host}:${port}/catalog/birthdays/MM-DD.json`);
});
