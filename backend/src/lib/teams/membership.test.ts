import type { OrganizationTeam } from "../../types/index.js";
import {
  supervisorCanManageTeam,
  teamIdsForUser,
} from "./membership.js";

describe("team membership helpers", () => {
  const teams: OrganizationTeam[] = [
    {
      teamId: "team-1",
      tenantId: "tenant-1",
      name: "Sales",
      status: "active",
      supervisorUserIds: ["supervisor-1"],
      memberUserIds: ["advisor-1", "advisor-2"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      teamId: "team-2",
      tenantId: "tenant-1",
      name: "Support",
      status: "active",
      supervisorUserIds: ["supervisor-2"],
      memberUserIds: ["advisor-2"],
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  it("returns team ids for members and supervisors", () => {
    expect(teamIdsForUser(teams, "advisor-2")).toEqual(["team-1", "team-2"]);
    expect(teamIdsForUser(teams, "supervisor-1")).toEqual(["team-1"]);
    expect(teamIdsForUser(teams, "unknown")).toEqual([]);
  });

  it("checks supervisor team management scope", () => {
    expect(supervisorCanManageTeam(teams[0], "supervisor-1")).toBe(true);
    expect(supervisorCanManageTeam(teams[0], "supervisor-2")).toBe(false);
  });
});
