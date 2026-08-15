import streamDeck from "@elgato/streamdeck";
import { HealthCheckAction } from "./actions/healthCheckAction.js";
import { HealthBoardAction } from "./actions/healthBoardAction.js";

streamDeck.actions.registerAction(new HealthCheckAction());
streamDeck.actions.registerAction(new HealthBoardAction());
streamDeck.connect();
