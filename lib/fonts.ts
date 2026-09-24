import { readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "assets", "fonts");
let cache: Awaited<ReturnType<typeof load>> | null = null;

async function load() {
  const f = (n: string) => readFile(path.join(dir, n));
  const [bodoni, bodoniHeavy, mono, monoBold] = await Promise.all([
    f("BodoniModa-SemiBold.ttf"),
    f("BodoniModa-ExtraBold.ttf"),
    f("IBMPlexMono-Regular.ttf"),
    f("IBMPlexMono-SemiBold.ttf"),
  ]);
  return [
    { name: "Bodoni", data: bodoni, weight: 600 as const, style: "normal" as const },
    { name: "Bodoni", data: bodoniHeavy, weight: 800 as const, style: "normal" as const },
    { name: "Mono", data: mono, weight: 400 as const, style: "normal" as const },
    { name: "Mono", data: monoBold, weight: 600 as const, style: "normal" as const },
  ];
}

export async function fonts() {
  cache ||= await load();
  return cache;
}
