import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { findHosts } from "./windowHost.js";

/**
 * Asking the user for a file, through the native host.
 *
 * A plugin cannot do this itself: a Node process is not an application, so it has no way to put a
 * dialog on screen, and shelling out to osascript costs around two seconds because the tool has to
 * register as a foreground app first. The host is already an app and already shipped, so it does
 * the asking and prints the chosen path.
 *
 * Only the native host can do this. A browser cannot be asked for a path at all, so on a machine
 * without the host, importing and exporting are unavailable rather than half working.
 */

const run = promisify(execFile);

export type FilePanelOptions = {
  saving: boolean;
  /** Suggested filename, for a save panel. */
  name?: string;
  prompt?: string;
};

/** Resolves to the chosen path, or null if the panel was cancelled. */
export async function chooseFile(options: FilePanelOptions): Promise<string | null> {
  const hosts = await findHosts();
  const native = hosts.find((host) => host.endsWith("pulse-host"));
  if (!native) {
    throw new Error(
      "Choosing a file needs the bundled helper, which is not available on this machine."
    );
  }

  const args = [options.saving ? "--save-panel" : "--open-panel"];
  if (options.name) args.push(`--name=${options.name}`);
  if (options.prompt) args.push(`--prompt=${options.prompt}`);

  // No timeout: the panel is open for as long as somebody is deciding, and there is no sensible
  // moment to give up on that.
  const { stdout } = await run(native, args, { maxBuffer: 1024 * 64 });
  const path = stdout.trim();
  return path === "" ? null : path;
}
