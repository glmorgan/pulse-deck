import { execSync } from "child_process";

export function showPopup(content: string): void {
  // Escape special characters for AppleScript string
  const escaped = content
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  const script = `display dialog "${escaped}" buttons {"OK"} default button "OK" with title "PulseDeck"`;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 30000,
    });
  } catch {
    // User dismissed or osascript unavailable — not an error
  }
}
