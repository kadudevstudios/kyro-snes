"use strict";

/**
 * Tiny static file server used by the desktop build and the e2e tests.
 * Serves the Vite `dist` output with correct MIME types for the WASM core.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

function createServer(rootDir) {
  const root = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400).end("Bad request");
      return;
    }

    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }

    let filePath = safeJoin(root, pathname);
    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (!error && stats.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      fs.readFile(filePath, (readError, data) => {
        if (readError) {
          // SPA fallback for unknown routes without an extension.
          if (!path.extname(filePath)) {
            fs.readFile(path.join(root, "index.html"), (fallbackError, fallback) => {
              if (fallbackError) {
                res.writeHead(404).end("Not found");
                return;
              }
              res.writeHead(200, { "Content-Type": MIME[".html"] }).end(fallback);
            });
            return;
          }
          res.writeHead(404).end("Not found");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const headers = {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Content-Length": data.length,
          "Cache-Control": ext === ".data" || ext === ".wasm" ? "public, max-age=31536000" : "no-cache",
        };
        res.writeHead(200, headers).end(data);
      });
    });
  });

  return server;
}

module.exports = { createServer, MIME };
