import {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type KeyUpEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";

import {
  DEFAULT_SETTINGS,
  type ButtonState,
  type CheckRecord,
  type HealthCheckSettings,
  type KeyInstance,
} from "../types.js";
import { runHealthCheck } from "../modules/healthChecker.js";
import { appendRecord, formatHistoryPopup } from "../modules/history.js";
import { showPopup } from "../modules/popup.js";
import {
  buildCheckRecord,
  evaluateButtonState,
  validateSettings,
  type CheckResult,
} from "../modules/stateEvaluator.js";
import {
  clearTimer,
  getIntervalMs,
  startTimer,
} from "../modules/timerManager.js";
import { getIcon } from "../modules/iconGenerator.js";

const LONG_PRESS_MS = 500;
const INITIAL_CHECK_DELAY_MS = 1500;

@action({ UUID: "com.glenmorgan.pulsedeck.healthcheck" })
export class HealthCheckAction extends SingletonAction<HealthCheckSettings> {
  private instances = new Map<string, KeyInstance>();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async onWillAppear(
    ev: WillAppearEvent<HealthCheckSettings>
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;

    const id = keyAction.id;
    const settings = mergeWithDefaults(ev.payload.settings);

    const instance: KeyInstance = {
      actionId: id,
      settings,
      isChecking: false,
      keyDownAt: null,
      timer: null,
    };
    this.instances.set(id, instance);

    const initialState = validateSettings(settings)
      ? "config-error"
      : settings.currentState;
    await renderState(keyAction, initialState, settings);

    if (settings.checkFrequency !== "manual") {
      setTimeout(() => void this.triggerCheck(id, keyAction), INITIAL_CHECK_DELAY_MS);
    }

    this.resetTimer(id, keyAction);
  }

  async onWillDisappear(
    ev: WillDisappearEvent<HealthCheckSettings>
  ): Promise<void> {
    const id = ev.action.id;
    const instance = this.instances.get(id);
    if (instance) {
      clearTimer(instance.timer);
      this.instances.delete(id);
    }
  }

  async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<HealthCheckSettings>
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;

    const id = keyAction.id;
    const settings = mergeWithDefaults(ev.payload.settings);
    const instance = this.instances.get(id);
    if (!instance) return;

    instance.settings = settings;
    this.resetTimer(id, keyAction);
    await renderState(keyAction, settings.currentState, settings);
  }

  // ── Key press ────────────────────────────────────────────────────────────

  onKeyDown(ev: KeyDownEvent<HealthCheckSettings>): void {
    const instance = this.instances.get(ev.action.id);
    if (instance) instance.keyDownAt = Date.now();
  }

  async onKeyUp(ev: KeyUpEvent<HealthCheckSettings>): Promise<void> {
    if (!ev.action.isKey()) return;

    const id = ev.action.id;
    const instance = this.instances.get(id);
    if (!instance) return;

    const pressDuration = instance.keyDownAt !== null
      ? Date.now() - instance.keyDownAt
      : 0;
    instance.keyDownAt = null;

    if (pressDuration >= LONG_PRESS_MS) {
      const text = formatHistoryPopup(
        instance.settings.serviceName,
        instance.settings.currentState,
        instance.settings.consecutiveFailures,
        instance.settings.history
      );
      setTimeout(() => showPopup(text), 0);
    } else {
      await this.triggerCheck(id, ev.action);
    }
  }

  // ── Check execution ───────────────────────────────────────────────────────

  private async triggerCheck(
    id: string,
    keyAction: KeyAction<HealthCheckSettings>
  ): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (instance.isChecking) return;

    const validationError = validateSettings(instance.settings);
    if (validationError) {
      instance.settings.currentState = "config-error";
      await renderState(keyAction, "config-error", instance.settings);
      return;
    }

    instance.isChecking = true;
    instance.settings.currentState = "checking";
    await renderState(keyAction, "checking", instance.settings);

    let result: CheckResult;
    try {
      result = await runHealthCheck(instance.settings);
    } finally {
      instance.isChecking = false;
    }

    if (result.ok) {
      instance.settings.consecutiveFailures = 0;
    } else {
      instance.settings.consecutiveFailures += 1;
    }

    const tempRecord: CheckRecord = {
      timestamp: new Date().toISOString(),
      ok: result.ok,
      state: "unknown",
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      bodyMatched: result.bodyMatched,
      bodySnippet: result.bodySnippet,
      error: result.error,
    };

    const newState = evaluateButtonState(
      instance.settings,
      instance.settings.consecutiveFailures,
      tempRecord
    );

    const record = buildCheckRecord(result, newState);

    instance.settings.history = appendRecord(instance.settings.history, record);
    instance.settings.currentState = newState;
    instance.settings.lastCheckedAt = record.timestamp;
    instance.settings.lastStatusCode = result.statusCode;
    instance.settings.lastResponseTimeMs = result.responseTimeMs;

    await renderState(keyAction, newState, instance.settings);
    await keyAction.setSettings(instance.settings);
  }

  // ── Timer management ──────────────────────────────────────────────────────

  private resetTimer(
    id: string,
    keyAction: KeyAction<HealthCheckSettings>
  ): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    clearTimer(instance.timer);
    instance.timer = null;

    const intervalMs = getIntervalMs(instance.settings.checkFrequency);
    if (intervalMs !== null) {
      instance.timer = startTimer(intervalMs, () => {
        void this.triggerCheck(id, keyAction);
      });
    }
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────

function mergeWithDefaults(
  saved: Partial<HealthCheckSettings>
): HealthCheckSettings {
  const base = { ...DEFAULT_SETTINGS, ...saved };
  // sdpi-components saves all text field values as strings; coerce numeric fields back
  return {
    ...base,
    expectedStatusCode: Number(base.expectedStatusCode) || DEFAULT_SETTINGS.expectedStatusCode,
    timeoutMs:          Number(base.timeoutMs)          || DEFAULT_SETTINGS.timeoutMs,
    slowThresholdMs:    Number(base.slowThresholdMs)    || DEFAULT_SETTINGS.slowThresholdMs,
    amberAfterFailures: Number(base.amberAfterFailures) || DEFAULT_SETTINGS.amberAfterFailures,
    redAfterFailures:   Number(base.redAfterFailures)   || DEFAULT_SETTINGS.redAfterFailures,
  };
}

// ── Module-level rendering helpers ─────────────────────────────────────────

async function renderState(
  keyAction: KeyAction<HealthCheckSettings>,
  state: ButtonState,
  settings: HealthCheckSettings
): Promise<void> {
  const icon = getIcon(state);
  const title = buildTitle(state, settings);
  await Promise.all([keyAction.setImage(icon), keyAction.setTitle(title)]);
}

function truncateName(name: string, max = 10): string {
  if (!name) return "";
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function buildTitle(state: ButtonState, settings: HealthCheckSettings): string {
  const name = truncateName(settings.serviceName);
  const ms = settings.lastResponseTimeMs;

  switch (state) {
    case "healthy":  return `${name}\nOK\n${ms ?? ""}ms`;
    case "slow":     return `${name}\nSlow\n${ms ?? ""}ms`;
    case "warning":  return `${name}\nWarn\n${settings.consecutiveFailures} fail`;
    case "down":     return `${name}\nDown\n${settings.consecutiveFailures} fail`;
    case "checking": return `${name}\nChecking`;
    case "config-error": return `Setup\nNeeded`;
    default:         return `${name}\n—`;
  }
}
