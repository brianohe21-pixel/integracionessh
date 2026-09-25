import { permissionsForRole, sanitizePermissions } from "./permissions.js";

describe("permissions", () => {
  it("gives member and supervisor the full catalog", () => {
    expect(permissionsForRole("member")).toEqual(permissionsForRole("supervisor"));
    expect(permissionsForRole("member")).toContain("bots.write");
    expect(permissionsForRole("member")).toContain("audit.read");
  });

  it("gives advisors no module permissions", () => {
    expect(permissionsForRole("advisor")).toEqual([]);
  });

  it("drops unknown permission keys", () => {
    expect(sanitizePermissions(["bots.read", "users.manage", "bots.read"])).toEqual(["bots.read"]);
  });
});
