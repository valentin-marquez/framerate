import { describe, expect, it } from "vitest";
import { client } from "../client";

describe("client()", () => {
	it("should create client with valid config", () => {
		const c = client({
			url: "http://localhost:54321",
			key: "anon-key",
		});
		expect(c).toBeDefined();
	});

	it("should throw without url", () => {
		expect(() => client({ url: "", key: "key" } as any)).toThrow(
			"Supabase URL and key are required",
		);
	});

	it("should accept options", () => {
		const c = client({
			url: "http://localhost:54321",
			key: "service-role-key",
			options: {
				auth: { persistSession: false },
			},
		});
		expect(c).toBeDefined();
	});
});
