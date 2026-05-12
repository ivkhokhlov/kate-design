import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultViewports = [
  { slug: "desktop", width: 1440, height: 1000 },
  { slug: "mobile", width: 390, height: 844 }
];

const options = parseArgs(process.argv.slice(2));
const timestamp = formatTimestamp(new Date());
const outputRoot = path.resolve(rootDir, options.out);
const outputDir = await getUniqueOutputDir(outputRoot, `portfolio-${timestamp}`);
const routes = await discoverRoutes();

if (routes.length === 0) {
  throw new Error("No pages found to screenshot.");
}

let server;
let baseUrl = options.base;

try {
  if (!baseUrl) {
    server = await startAstroServer(options.port);
    baseUrl = server.baseUrl;
  }

  await fs.mkdir(outputDir, { recursive: true });
  const { results, failures } = await capturePages(baseUrl, outputDir, routes, defaultViewports);
  const manifest = {
    generatedAt: new Date().toISOString(),
    base: baseUrl,
    outputDir,
    viewports: defaultViewports,
    routes,
    results,
    failures
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nSaved ${results.length} screenshots to ${outputDir}`);
  console.log(`Manifest: ${path.join(outputDir, "manifest.json")}`);

  if (failures.length > 0) {
    console.error(`Failures: ${failures.length}`);
    process.exitCode = 1;
  }
} finally {
  if (server) {
    await server.stop();
  }
}

function parseArgs(args) {
  const parsed = {
    base: "",
    out: ".playwright-cli/screenshots",
    port: "4321"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--base" && next) {
      parsed.base = trimTrailingSlash(next);
      index += 1;
    } else if (arg === "--out" && next) {
      parsed.out = next;
      index += 1;
    } else if (arg === "--port" && next) {
      parsed.port = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run screenshots -- [options]

Options:
  --base <url>   Use an already running site instead of starting Astro.
  --out <dir>    Output root directory. Default: .playwright-cli/screenshots
  --port <port>  Preferred Astro dev port. Default: 4321
`);
}

async function discoverRoutes() {
  const staticRoutes = await discoverStaticPageRoutes(path.join(rootDir, "src/pages"));
  const workRoutes = await discoverWorkRoutes(path.join(rootDir, "src/content/work"));
  const byPath = new Map();

  for (const route of [...staticRoutes, ...workRoutes]) {
    byPath.set(route.path, route);
  }

  return Array.from(byPath.values()).sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return (a.order ?? 9999) - (b.order ?? 9999) || a.path.localeCompare(b.path);
  });
}

async function discoverStaticPageRoutes(pagesDir) {
  const files = await walkFiles(pagesDir);

  return files
    .filter((file) => /\.(astro|md|mdx)$/i.test(file))
    .filter((file) => !path.basename(file).startsWith("_"))
    .filter((file) => !file.includes("["))
    .map((file) => {
      const relative = path.relative(pagesDir, file).replace(/\.(astro|md|mdx)$/i, "");
      const routePath = pageFileToRoutePath(relative);

      return {
        slug: routePath === "/" ? "home" : routePathToFileSlug(routePath),
        path: routePath
      };
    });
}

async function discoverWorkRoutes(workDir) {
  const files = await walkFiles(workDir);

  return files
    .filter((file) => /\.mdx?$/i.test(file))
    .map(async (file) => {
      const content = await fs.readFile(file, "utf8");
      const basename = path.basename(file).replace(/\.mdx?$/i, "");
      const orderMatch = content.match(/^order:\s*(\d+)/m);

      return {
        slug: basename,
        path: `/work/${basename}/`,
        order: Number(orderMatch?.[1] ?? 9999)
      };
    })
    .reduce(async (promise, routePromise) => [...(await promise), await routePromise], Promise.resolve([]));
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }

      return entry.isFile() ? [entryPath] : [];
    })
  );

  return files.flat();
}

function pageFileToRoutePath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  const withoutIndex = normalized === "index" ? "" : normalized.replace(/\/index$/, "");

  return `/${withoutIndex}${withoutIndex ? "/" : ""}`;
}

function routePathToFileSlug(routePath) {
  return routePath.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

async function startAstroServer(port) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", "dev", "--", "--host", "127.0.0.1", "--port", port], {
    cwd: rootDir,
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let ready = false;
  let recentOutput = "";

  const stop = async () => {
    if (child.exitCode !== null) return;

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        resolve();
      }, 5000);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });

      child.kill("SIGINT");
    });
  };

  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Astro dev server did not become ready.\n${recentOutput}`));
    }, 60000);

    const onData = (chunk) => {
      const text = stripAnsi(chunk.toString());
      recentOutput = `${recentOutput}${text}`.slice(-4000);
      process.stdout.write(text);

      const match = text.match(/Local\s+(https?:\/\/127\.0\.0\.1:\d+(?:\/[^\s]*)?)/);
      if (match && !ready) {
        ready = true;
        clearTimeout(timeout);
        resolve(trimTrailingSlash(match[1]));
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Astro dev server exited before it was ready. Exit code: ${code}\n${recentOutput}`));
      }
    });
  });

  return { baseUrl, stop };
}

async function capturePages(baseUrl, outputDir, routes, viewports) {
  let browser;
  const results = [];
  const failures = [];

  try {
    try {
      browser = await chromium.launch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("playwright install")) {
        throw new Error(`Playwright Chromium is not installed. Run \`npx playwright install chromium\` once, then retry.\n\n${message}`);
      }

      throw error;
    }

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        locale: "ru-RU",
        reducedMotion: "reduce"
      });

      for (const route of routes) {
        const page = await context.newPage();
        const url = toRouteUrl(baseUrl, route.path);
        const file = path.join(outputDir, `${viewport.slug}-${route.slug}.png`);

        try {
          const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
          const status = response?.status() ?? 0;

          if (!response || status >= 400) {
            throw new Error(`HTTP ${status}`);
          }

          await scrollThroughPage(page);
          await waitForPageAssets(page);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(250);
          await page.screenshot({ path: file, fullPage: true, animations: "disabled" });

          const title = await page.title();
          const images = await page.locator("img").count();
          results.push({ viewport: viewport.slug, route: route.path, title, images, file });
          console.log(`saved ${viewport.slug}-${route.slug}.png (${title})`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ viewport: viewport.slug, route: route.path, message });
          console.error(`failed ${viewport.slug} ${route.path}: ${message}`);
        } finally {
          await page.close().catch(() => {});
        }
      }

      await context.close();
    }
  } finally {
    await browser?.close();
  }

  return { results, failures };
}

async function waitForPageAssets(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);

    await Promise.all(
      images.map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            const done = () => {
              clearTimeout(timer);
              resolve();
            };
            const timer = setTimeout(done, 8000);

            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        }

        if (img.decode) {
          await img.decode().catch(() => {});
        }
      })
    );

    await document.fonts?.ready;
  });
}

async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const steps = Math.max(4, Math.ceil(maxScroll / 700));

    for (let step = 0; step <= steps; step += 1) {
      window.scrollTo(0, Math.round((maxScroll * step) / steps));
      await sleep(100);
    }
  });
}

async function getUniqueOutputDir(parentDir, dirname) {
  let candidate = path.join(parentDir, dirname);

  for (let index = 2; await exists(candidate); index += 1) {
    candidate = path.join(parentDir, `${dirname}-${index}`);
  }

  return candidate;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function toRouteUrl(baseUrl, routePath) {
  const base = `${trimTrailingSlash(baseUrl)}/`;
  const relativeRoute = routePath === "/" ? "" : routePath.replace(/^\/+/, "");

  return new URL(relativeRoute, base).toString();
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}
