import type { Hand, MouseFitReportRequest } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const mouseFitClient = {
  getHand: () => api.get<{ hand: Hand | null }>("/v1/me/hand"),
  saveHand: (hand: Hand) => api.put<{ hand: Hand }>("/v1/me/hand", hand),
  deleteHand: () => api.delete("/v1/me/hand"),
  report: (report: MouseFitReportRequest) => api.post("/v1/mouse-fit/reports", report),
};
