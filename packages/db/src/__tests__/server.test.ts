import { describe, expect, it } from "vitest";
import { server } from "../server";

describe("server()", () => {
	it("should create server client with request", () => {
		const request = new Request("http://localhost:3000");
		const { supabase, headers } = server({
			url: "http://localhost:54321",
			anonKey: "anon-key",
			request,
		});

		expect(supabase).toBeDefined();
		expect(headers).toBeInstanceOf(Headers);
	});

	it("should throw without url", () => {
		const request = new Request("http://localhost:3000");
		expect(() => server({ url: "", anonKey: "key", request } as any)).toThrow(
			"Supabase URL and anon key are required",
		);
	});
});
