import path from "node:path";
import { Config } from "@remotion/cli/config";

// Hanate is drawn once, in the app (components/parampara/hanate/art.tsx); the video imports that
// file rather than a copy. Its one app only import, `@/lib/utils` (a class name helper), points at
// a tiny shim here, so the video never needs the app's node_modules.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      "@/lib/utils": path.resolve(process.cwd(), "src/shims/utils.ts"),
    },
  },
}));

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
