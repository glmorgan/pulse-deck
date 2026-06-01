import streamDeck from "@elgato/streamdeck";
import { HealthCheckAction } from "./actions/healthCheckAction.js";

streamDeck.actions.registerAction(new HealthCheckAction());
streamDeck.connect();
