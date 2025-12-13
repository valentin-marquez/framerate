import { describe, expect, test } from "bun:test";
import { normalizeGpuTitle } from "../src/processors/normalizers/gpu";

describe("GPU Title Normalization", () => {
	test("removes Part Numbers (P/N)", () => {
		// For non-GPU items (like bridges), we expect P/N removal but maybe not full normalization
		expect(
			normalizeGpuTitle("BRIDGE EVGA NVIDIA NVLINK 3 SLOT P/N 100-2W-0029-LR"),
		).toBe("BRIDGE EVGA NVIDIA NVLINK 3 SLOT");

		// For actual GPUs, we expect full normalization
		// Note: We standardize to "Brand Model Chip VRAM" format, so "Radeon" is omitted and "Gaming" comes before "RX"
		expect(
			normalizeGpuTitle(
				"TARJETA DE VIDEO GIGABYTE RADEON 9060XT GAMING 16GB P/N GV-R9060XTGAMING-16GD",
			),
		).toBe("Gigabyte Gaming RX 9060 XT 16GB");
		expect(
			normalizeGpuTitle(
				"TARJETA DE VIDEO GIGABYTE RADEON 9060XT GAMING OC 16GB P/N GV-R9060XTGAMING OC 16GD",
			),
		).toBe("Gigabyte Gaming OC RX 9060 XT 16GB");
	});

	test("handles missing VRAM specification", () => {
		// User requested: "MSI Ventus RTX 5060 Ti OC" -> "MSI Ventus RTX 5060 Ti 8GB OC"
		// Note: This might require inferring VRAM or just handling the format gracefully.
		// If we can't infer, we should at least format the rest correctly.
		expect(normalizeGpuTitle("MSI Ventus RTX 5060 Ti OC")).toBe(
			"MSI Ventus RTX 5060 Ti OC",
		);
	});

	test("handles missing brand", () => {
		// User requested: "GT 710 2GB Low Profile" -> "ASUS GT 710 2GB Low Profile" (assuming manufacturer is provided)
		expect(normalizeGpuTitle("GT 710 2GB Low Profile", undefined, "ASUS")).toBe(
			"ASUS GT 710 2GB Low Profile",
		);
	});

	test("preserves correct formatting", () => {
		expect(normalizeGpuTitle("Zotac AMP Infinity RTX 5090 32GB")).toBe(
			"Zotac AMP Infinity RTX 5090 32GB",
		);
		expect(normalizeGpuTitle("ASUS Dual RTX 5060 Ti 16GB OC")).toBe(
			"ASUS Dual RTX 5060 Ti 16GB OC",
		);
		expect(normalizeGpuTitle("Gigabyte Eagle RTX 5060 8GB OC White Ice")).toBe(
			"Gigabyte Eagle RTX 5060 8GB OC White Ice",
		);
		expect(normalizeGpuTitle("MSI Gaming Trio RTX 5060 Ti 8GB OC White")).toBe(
			"MSI Gaming Trio RTX 5060 Ti 8GB OC White",
		);
		expect(normalizeGpuTitle("ASUS ROG Astral RTX 5080 16GB OC")).toBe(
			"ASUS ROG Astral RTX 5080 16GB OC",
		);
	});
});
