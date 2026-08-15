import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type KeyUpEvent,
  type SendToPluginEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { runHealthCheck } from "../modules/healthChecker.js";
import { appendRecord } from "../modules/history.js";
import { renderBoardIcon } from "../modules/boardIcon.js";
import {
  buildCheckRecord,
  evaluateButtonState,
  validateSettings,
} from "../modules/stateEvaluator.js";
import { clearTimer, getIntervalMs, startTimer } from "../modules/timerManager.js";
import {
  boardCells,
  mergeBoardSettings,
  newService,
  newServiceId,
  resolveService,
  runtimeFor,
} from "../board/board.js";
import { BOARD_CAPACITY } from "../modules/boardIcon.js";
import { buildSnapshot } from "../modules/snapshot.js";
import { renderHistoryHtml } from "../modules/historyWindow.js";
import { buildBoardOverview } from "../board/boardSnapshot.js";
import { findHosts, showBoardWindow } from "../board/boardWindow.js";
import {
  EMPTY_RUNTIME,
  type BoardDefaults,
  type BoardSettings,
  type ServiceConfig,
  type ServiceRuntime,
} from "../board/types.js";

/**
 * Health Board — up to twelve services on one key.
 *
 * Shares every piece of checking logic with the single-endpoint action: a service is flattened
 * onto the board's defaults into exactly the settings shape `runHealthCheck` and
 * `evaluateButtonState` already take. What is new here is the round — a whole board on one timer
 * — and the key face, which is generated rather than picked off disk.
 */

const LONG_PRESS_MS = 500;
const INITIAL_CHECK_DELAY_MS = 1500;
/**
 * Gap between services within a round.
 *
 * A board's worth of simultaneous requests is not a load problem, but it is a spike in whatever
 * the endpoints report, and it makes a round indivisible: staggering means the key fills in cell
 * by cell, so a slow service is visible as a cell that has not turned yet rather than as a frozen
 * key.
 *
 * At the cap this spreads a round over roughly five seconds before any response time is counted,
 * so it is the figure to revisit if the shortest check frequency ever comes down.
 */
const STAGGER_MS = 300;

interface BoardInstance {
  settings: BoardSettings;
  keyDownAt: number | null;
  timer: ReturnType<typeof setInterval> | null;
  /** Service ids with a check in flight, so a round never doubles up on one. */
  inFlight: Set<string>;
  roundRunning: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  /** True from the moment a window is asked for, so a second press cannot open a second one. */
  windowOpen: boolean;
  /** Dismisses the open window when the key goes away. */
  closeWindow: (() => void) | null;
  /**
   * The last deleted service, its runtime and where it sat, until something else is deleted.
   *
   * Deliberately not in settings: a deleted service persisted "just in case" means every board
   * quietly carries the history of everything ever removed from it. The cost is that undo does
   * not survive a plugin restart, which is the right trade for a delete you can see happen.
   */
  lastDeleted: { index: number; service: ServiceConfig; runtime: ServiceRuntime } | null;
}

@action({ UUID: "com.glenmorgan.pulsedeck.healthboard" })
export class HealthBoardAction extends SingletonAction<BoardSettings> {
  private instances = new Map<string, BoardInstance>();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async onWillAppear(ev: WillAppearEvent<BoardSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;

    const instance: BoardInstance = {
      settings: mergeBoardSettings(ev.payload.settings),
      keyDownAt: null,
      timer: null,
      inFlight: new Set(),
      roundRunning: false,
      saveTimer: null,
      windowOpen: false,
      closeWindow: null,
      lastDeleted: null,
    };
    this.instances.set(keyAction.id, instance);

    await this.drawKey(keyAction, instance);

    if (instance.settings.services.length > 0) {
      setTimeout(() => void this.runRound(keyAction.id, keyAction), INITIAL_CHECK_DELAY_MS);
    }
    this.resetTimer(keyAction.id, keyAction);
  }

  async onWillDisappear(ev: WillDisappearEvent<BoardSettings>): Promise<void> {
    const instance = this.instances.get(ev.action.id);
    if (!instance) return;
    clearTimer(instance.timer);
    if (instance.saveTimer) clearTimeout(instance.saveTimer);
    // A window outlives its key otherwise, polling a board that has stopped moving.
    instance.closeWindow?.();
    this.instances.delete(ev.action.id);
  }

  async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BoardSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const instance = this.instances.get(ev.action.id);
    if (!instance) return;
    // A round in flight owns the runtime it is about to write; taking settings from underneath it
    // would lose the results of checks that have already run.
    if (instance.roundRunning) return;
    instance.settings = mergeBoardSettings(ev.payload.settings);
    this.resetTimer(ev.action.id, ev.action);
    await this.drawKey(ev.action, instance);
  }

  // ── Key press ────────────────────────────────────────────────────────────

  onKeyDown(ev: KeyDownEvent<BoardSettings>): void {
    const instance = this.instances.get(ev.action.id);
    if (instance) instance.keyDownAt = Date.now();
  }

  async onKeyUp(ev: KeyUpEvent<BoardSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const instance = this.instances.get(ev.action.id);
    if (!instance) return;

    const held = instance.keyDownAt !== null ? Date.now() - instance.keyDownAt : 0;
    instance.keyDownAt = null;

    // An empty board has nothing to check, so the short press goes where the services are added.
    if (held >= LONG_PRESS_MS || instance.settings.services.length === 0) {
      // Not awaited: the window stays open until it is closed, and awaiting it here would hold
      // the key's event handler for as long as someone is reading it.
      void this.openManager(ev.action.id, ev.action);
      return;
    }
    await this.runRound(ev.action.id, ev.action);
  }

  /**
   * Opens the manager window, working down the available hosts.
   *
   * A host can be present yet fail to launch, so a failure tries the next one rather than being
   * mistaken for the user closing the window. Unlike the history window there is no osascript
   * fallback: a dialog cannot manage a list, and pretending otherwise would be worse than saying
   * plainly that no window host is available.
   */
  private async openManager(
    id: string,
    keyAction: KeyAction<BoardSettings>
  ): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (instance.windowOpen) return;
    instance.windowOpen = true;

    try {
      for (const host of await findHosts()) {
        try {
          await showBoardWindow(host, {
            getOverview: () =>
              buildBoardOverview(instance.settings, instance.lastDeleted?.service.name ?? null),
            onCheckAll: () => this.runRound(id, keyAction),
            onCheckService: async (serviceId) => {
              await this.checkService(keyAction, instance, serviceId);
              await this.persist(keyAction, instance);
            },
            // The selected service's pane is the history window's own page, embedded. Both
            // windows render the same view from the same snapshot rather than each having one.
            getServicePage: (serviceId, token) => {
              const snapshot = this.snapshotFor(instance, serviceId);
              if (!snapshot) return null;
              return renderHistoryHtml(snapshot, token, {
                canCheck: false,
                embedded: true,
                scope: serviceId,
              });
            },
            getServiceSnapshot: (serviceId) => this.snapshotFor(instance, serviceId),
            onAddService: async (draft) => {
              if (instance.settings.services.length >= BOARD_CAPACITY) {
                throw new Error(`A board holds ${BOARD_CAPACITY} services.`);
              }
              const service: ServiceConfig = {
                ...newService(String(draft.name ?? ""), String(draft.url ?? "")),
                ...draft,
                id: newServiceId(),
              };
              instance.settings.services.push(service);
              instance.settings.runtime[service.id] = { ...EMPTY_RUNTIME };
              await this.afterMutation(keyAction, instance);
              // Checked straight away rather than waiting for the next round: adding a service is
              // exactly when you want to know whether the URL was right.
              void this.checkService(keyAction, instance, service.id)
                .then(() => this.persist(keyAction, instance));
              return service.id;
            },
            onUpdateService: async (serviceId, draft) => {
              const index = instance.settings.services.findIndex((s) => s.id === serviceId);
              if (index < 0) throw new Error("That service is no longer on this board.");
              const existing = instance.settings.services[index];
              instance.settings.services[index] = { ...existing, ...draft, id: existing.id };
              await this.afterMutation(keyAction, instance);
              void this.checkService(keyAction, instance, serviceId)
                .then(() => this.persist(keyAction, instance));
            },
            onDeleteService: async (serviceId) => {
              const index = instance.settings.services.findIndex((s) => s.id === serviceId);
              if (index < 0) return;
              const [service] = instance.settings.services.splice(index, 1);
              const runtime = runtimeFor(instance.settings, serviceId);
              delete instance.settings.runtime[serviceId];
              instance.lastDeleted = { index, service, runtime };
              await this.afterMutation(keyAction, instance);
            },
            onUndoDelete: async () => {
              const held = instance.lastDeleted;
              if (!held) throw new Error("There is nothing to undo.");
              if (instance.settings.services.length >= BOARD_CAPACITY) {
                throw new Error("The board is full; remove a service before restoring one.");
              }
              // Back where it was, so the grid position it had is the position it gets.
              instance.settings.services.splice(held.index, 0, held.service);
              instance.settings.runtime[held.service.id] = held.runtime;
              instance.lastDeleted = null;
              await this.afterMutation(keyAction, instance);
              return held.service.id;
            },
            onMoveService: async (serviceId, delta) => {
              const services = instance.settings.services;
              const from = services.findIndex((s) => s.id === serviceId);
              const to = from + delta;
              if (from < 0 || to < 0 || to >= services.length) return;
              const [moved] = services.splice(from, 1);
              services.splice(to, 0, moved);
              await this.afterMutation(keyAction, instance);
            },
            onUpdateBoard: async (update) => {
              const frequencyChanged =
                update.defaults?.checkFrequency !== undefined
                && update.defaults.checkFrequency !== instance.settings.defaults.checkFrequency;
              if (typeof update.boardName === "string") {
                instance.settings.boardName = update.boardName.trim() || "Health board";
              }
              if (update.defaults) {
                instance.settings.defaults = { ...instance.settings.defaults, ...update.defaults };
              }
              await this.afterMutation(keyAction, instance);
              // The round's clock is the board's, so a changed frequency has to restart it.
              if (frequencyChanged) this.resetTimer(id, keyAction);
            },
            onOpen: (close) => { instance.closeWindow = close; },
            onWarn: (message) => streamDeck.logger.warn(message),
          });
          return;
        } catch (error) {
          streamDeck.logger.warn("Board window host unavailable, trying the next one:", error);
        }
      }
      streamDeck.logger.error(
        "No window host available: the board cannot be managed without one. Build the native "
        + "host with npm run build:native, or install a Chromium-family browser."
      );
    } finally {
      instance.windowOpen = false;
      instance.closeWindow = null;
    }
  }

  /**
   * What every mutation owes: a redrawn key and a write.
   *
   * The key is the only thing most people look at, so it must not lag a change made in the
   * window, and the write is debounced so a burst of edits costs one save rather than five.
   */
  private async afterMutation(
    keyAction: KeyAction<BoardSettings>,
    instance: BoardInstance
  ): Promise<void> {
    await this.drawKey(keyAction, instance);
    await this.persist(keyAction, instance);
  }

  /** One service as the single-endpoint modules see it, or null if the board has no such id. */
  private snapshotFor(instance: BoardInstance, serviceId: string) {
    const service = instance.settings.services.find((s) => s.id === serviceId);
    if (!service) return null;
    return buildSnapshot(
      resolveService(instance.settings.defaults, service, runtimeFor(instance.settings, serviceId))
    );
  }

  // ── Inspector messages ───────────────────────────────────────────────────

  /**
   * Temporary bridge for adding and removing services until the manager window exists.
   *
   * The inspector will end up holding a single button, so nothing here is meant to last; it is
   * what makes the board testable end to end in the meantime.
   */
  async onSendToPlugin(ev: SendToPluginEvent<JsonValue, BoardSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const keyAction = ev.action;
    const instance = this.instances.get(keyAction.id);
    if (!instance) return;

    const payload = ev.payload as { event?: string; name?: string; url?: string; id?: string };

    if (payload.event === "addService" && typeof payload.url === "string") {
      if (instance.settings.services.length >= BOARD_CAPACITY) {
        streamDeck.logger.warn(`board is full; ${BOARD_CAPACITY} services is the cap`);
        return;
      }
      const service = newService(payload.name?.trim() || hostOf(payload.url), payload.url.trim());
      instance.settings.services.push(service);
      instance.settings.runtime[service.id] = { ...EMPTY_RUNTIME };
      await this.persist(keyAction, instance);
      await this.drawKey(keyAction, instance);
      this.resetTimer(keyAction.id, keyAction);
      await this.checkService(keyAction, instance, service.id);
      return;
    }

    if (payload.event === "removeLast") {
      const gone = instance.settings.services.pop();
      if (gone) delete instance.settings.runtime[gone.id];
      await this.persist(keyAction, instance);
      await this.drawKey(keyAction, instance);
      return;
    }

    if (payload.event === "checkAll") {
      await this.runRound(keyAction.id, keyAction);
    }
  }

  // ── Checking ─────────────────────────────────────────────────────────────

  /**
   * One pass over every service, staggered.
   *
   * The key is redrawn as each result lands rather than once at the end, so a round is visible as
   * it happens. Settings are written once, after the whole round: nine services measured 60–80KB
   * of settings, so a full board is more than twice that, and persisting per check would rewrite
   * all of it once per service.
   */
  private async runRound(id: string, keyAction: KeyAction<BoardSettings>): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance || instance.roundRunning) return;
    if (instance.settings.services.length === 0) return;

    instance.roundRunning = true;
    try {
      const ids = instance.settings.services.map((service) => service.id);
      for (let i = 0; i < ids.length; i++) {
        if (i > 0) await delay(STAGGER_MS);
        // Not awaited: a slow service must not hold up the rest of the round, and each result
        // redraws the key as it arrives.
        void this.checkService(keyAction, instance, ids[i]);
      }
      // Let the last request finish before persisting, so the round is written whole.
      await this.settle(instance);
      await this.persist(keyAction, instance);
    } finally {
      instance.roundRunning = false;
    }
  }

  private async checkService(
    keyAction: KeyAction<BoardSettings>,
    instance: BoardInstance,
    serviceId: string
  ): Promise<void> {
    const service = instance.settings.services.find((s) => s.id === serviceId);
    if (!service) return;
    // A service still answering from the last round is skipped rather than queued: two checks of
    // the same endpoint in flight would write two records for one interval.
    if (instance.inFlight.has(serviceId)) return;

    const runtime = runtimeFor(instance.settings, serviceId);
    const resolved = resolveService(instance.settings.defaults, service, runtime);

    if (validateSettings(resolved)) {
      runtime.currentState = "config-error";
      instance.settings.runtime[serviceId] = runtime;
      await this.drawKey(keyAction, instance);
      return;
    }

    instance.inFlight.add(serviceId);
    runtime.currentState = "checking";
    instance.settings.runtime[serviceId] = runtime;
    await this.drawKey(keyAction, instance);

    try {
      const result = await runHealthCheck(resolved);
      const failures = result.ok ? 0 : runtime.consecutiveFailures + 1;
      const record = buildCheckRecord(
        result,
        evaluateButtonState(resolved, failures, buildCheckRecord(result, "unknown"))
      );

      instance.settings.runtime[serviceId] = {
        history: appendRecord(runtime.history, record),
        currentState: record.state,
        consecutiveFailures: failures,
        lastCheckedAt: record.timestamp,
        lastStatusCode: result.statusCode,
        lastResponseTimeMs: result.responseTimeMs,
      };
    } finally {
      instance.inFlight.delete(serviceId);
    }

    await this.drawKey(keyAction, instance);
  }

  /** Waits for the round's requests to land, bounded so one hung service cannot stall the save. */
  private async settle(instance: BoardInstance): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (instance.inFlight.size > 0 && Date.now() < deadline) await delay(100);
  }

  // ── Persistence and drawing ──────────────────────────────────────────────

  /** Debounced, so a manual check during a round does not write the whole board twice. */
  private async persist(
    keyAction: KeyAction<BoardSettings>,
    instance: BoardInstance
  ): Promise<void> {
    if (instance.saveTimer) clearTimeout(instance.saveTimer);
    instance.saveTimer = setTimeout(() => {
      instance.saveTimer = null;
      void keyAction.setSettings(instance.settings);
    }, 250);
  }

  private async drawKey(
    keyAction: { setImage(image: string): Promise<void> },
    instance: BoardInstance
  ): Promise<void> {
    await keyAction.setImage(renderBoardIcon(boardCells(instance.settings)));
  }

  private resetTimer(id: string, keyAction: KeyAction<BoardSettings>): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    clearTimer(instance.timer);
    instance.timer = null;
    const intervalMs = getIntervalMs(instance.settings.defaults.checkFrequency);
    if (intervalMs !== null) {
      instance.timer = startTimer(intervalMs, () => void this.runRound(id, keyAction));
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A URL is a reasonable name until someone types a better one. */
function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return "New service";
  }
}
