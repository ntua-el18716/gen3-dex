/**
 * Builds the release APK: dist/gen3-companion-<version>.apk
 *
 *   npm run apk
 *
 * 1. Regenerates android/ from app.json and the config plugins
 *    (`expo prebuild`; android/ is gitignored, never edited by hand).
 * 2. Runs Gradle's assembleRelease.
 *
 * Signing: plugins/with-release-signing.js uses our key when the
 * GEN3_UPLOAD_* Gradle properties are set (~/.gradle/gradle.properties
 * locally, ORG_GRADLE_PROJECT_* variables in CI), else the debug key.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const run = (cmd: string, args: string[], cwd = root) => {
  // .cmd/.bat wrappers (npx, gradlew.bat) only run through cmd.exe on Windows.
  const [file, fileArgs] =
    process.platform === "win32"
      ? ["cmd.exe", ["/d", "/c", cmd, ...args]]
      : [cmd, args];
  execFileSync(file, fileArgs, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CI: "1" }, // no interactive prompts
  });
};

function hasReleaseKey(): boolean {
  if (process.env.ORG_GRADLE_PROJECT_GEN3_UPLOAD_STORE_FILE) return true;
  const props = path.join(homedir(), ".gradle", "gradle.properties");
  return (
    existsSync(props) &&
    /^GEN3_UPLOAD_STORE_FILE=/m.test(readFileSync(props, "utf8"))
  );
}

// Prebuild rewrites the "android"/"ios" scripts to `expo run:*`; we keep
// `expo start` (Expo Go) for development, so put package.json back.
const packageJsonPath = path.join(root, "package.json");
const packageJson = readFileSync(packageJsonPath, "utf8");
try {
  run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
} finally {
  writeFileSync(packageJsonPath, packageJson);
}

/**
 * Windows: the native modules' C++ build paths exceed 260 characters, and
 * the ninja in the SDK's default CMake (3.22.1, ninja 1.10) can't handle
 * that; CMake 3.30+ ships ninja 1.12, which can. Use the newest such CMake
 * (install with `sdkmanager "cmake;3.31.6"`).
 */
function newerCmakeDir(): string | null {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk || !existsSync(path.join(sdk, "cmake"))) return null;
  const version = (v: string) => v.split(".").map(Number);
  const newest = readdirSync(path.join(sdk, "cmake"))
    .filter((v) => {
      const [major = 0, minor = 0] = version(v);
      return major === 3 && minor >= 30;
    })
    .sort((a, b) => {
      const [x, y] = [version(a), version(b)];
      return x[1]! - y[1]! || (x[2] ?? 0) - (y[2] ?? 0);
    })
    .pop();
  return newest ? path.join(sdk, "cmake", newest) : null;
}

if (process.platform === "win32") {
  const cmake = newerCmakeDir();
  if (!cmake)
    throw new Error(
      'Windows builds need CMake 3.30+ from the Android SDK: sdkmanager "cmake;3.31.6"',
    );
  writeFileSync(
    path.join(root, "android", "local.properties"),
    `cmake.dir=${cmake.replace(/\\/g, "/")}\n`,
  );
}

const android = path.join(root, "android");
run(
  path.join(android, process.platform === "win32" ? "gradlew.bat" : "gradlew"),
  ["app:assembleRelease", "--console=plain"],
  android,
);

// The app's version (versionName in the APK) lives in app.json.
const appJson = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
const { version } = (appJson as { expo: { version: string } }).expo;
const built = path.join(
  android,
  "app/build/outputs/apk/release/app-release.apk",
);
const out = path.join(root, "dist", `gen3-companion-${version}.apk`);
mkdirSync(path.dirname(out), { recursive: true });
copyFileSync(built, out);
console.log(`\n✓ ${path.relative(root, out)}`);
if (!hasReleaseKey())
  console.warn(
    "⚠ Signed with the debug key (no GEN3_UPLOAD_* properties). Fine for testing; don't publish it.",
  );
