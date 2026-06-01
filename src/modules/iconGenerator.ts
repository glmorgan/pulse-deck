import type { ButtonState } from "../types.js";

const ICON_PATH: Record<ButtonState, string> = {
  healthy:       "imgs/actions/healthcheck/success",
  slow:          "imgs/actions/healthcheck/warn",
  warning:       "imgs/actions/healthcheck/warn",
  down:          "imgs/actions/healthcheck/failure",
  checking:      "imgs/actions/healthcheck/loading",
  unknown:       "imgs/actions/healthcheck/config",
  "config-error":"imgs/actions/healthcheck/config",
};

export function getIcon(state: ButtonState): string {
  return ICON_PATH[state] ?? ICON_PATH["unknown"];
}
