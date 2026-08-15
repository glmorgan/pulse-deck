import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.glenmorgan.pulsedeck.sdPlugin/plugin.js",
    format: "commonjs",
    sourcemap: false,
    exports: "auto",
    inlineDynamicImports: true
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" })
  ],
  external: [
    "child_process",
    "crypto",
    "fs",
    "fs/promises",
    "http",
    "net",
    "os",
    "path",
    "node:child_process",
    "node:crypto",
    "node:fs",
    "node:fs/promises",
    "node:http",
    "node:net",
    "node:os",
    "node:path",
    "node:util"
  ]
};
