import { Elysia } from "elysia";

const app = new Elysia().get("/", () => "Tracker Service is running").listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

// Placeholder for cron job
const INTERVAL = 1000 * 60 * 60; // 1 hour

console.log("Tracker service started");

setInterval(() => {
  console.log("Running inventory update...");
  // TODO: Implement inventory update logic
}, INTERVAL);
