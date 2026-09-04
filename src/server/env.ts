let loaded = false;

export function ensureServerEnvLoaded() {
  if (loaded) return;
  loaded = true;

  const loadEnvFile = (
    process as NodeJS.Process & {
      loadEnvFile?: (path?: string) => void;
    }
  ).loadEnvFile;

  try {
    loadEnvFile?.(".env");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    console.warn("Could not load local .env file", error);
  }
}
