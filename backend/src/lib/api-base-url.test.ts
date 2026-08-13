import { resolveApiBaseUrl, resolveApiBaseUrlFromEnv } from "./api-base-url.js";

describe("resolveApiBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_BASE_URL;
    delete process.env.API_PUBLIC_URL;
    delete process.env.PUBLIC_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers API_PUBLIC_URL from environment", () => {
    process.env.API_PUBLIC_URL = "https://api.example.com/";
    expect(resolveApiBaseUrlFromEnv()).toBe("https://api.example.com");
    expect(resolveApiBaseUrl()).toBe("https://api.example.com");
  });

  it("derives URL from API Gateway event when env is missing", () => {
    const url = resolveApiBaseUrl({
      headers: { host: "ccti8rpoj1.execute-api.us-east-1.amazonaws.com" },
      requestContext: { domainName: "ccti8rpoj1.execute-api.us-east-1.amazonaws.com" },
    } as never);
    expect(url).toBe("https://ccti8rpoj1.execute-api.us-east-1.amazonaws.com");
  });

  it("returns empty string when env and event are unavailable", () => {
    expect(resolveApiBaseUrl()).toBe("");
  });
});
