import type { Store } from "../database";
export async function seedOperationsDemo(s: Store) {
  if (await s.get("demo", "seasons", "demo-season-current")) return;
  const today = new Date(),
    year = today.getUTCFullYear();
  const day = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await s.transaction(async () => {
    for (let i = 0; i < 3; i++) {
      const y = year - 2 + i,
        id = i === 2 ? "demo-season-current" : "demo-season-" + y;
      const season = {
        id,
        name: `DEMO ${y} WET SEASON`,
        programId: "pr-wet",
        organizationId: "org-kebbi",
        type: "Wet",
        year: y,
        crop: "Rice",
        startDate: i === 2 ? day(-130) : `${y}-01-01`,
        endDate: i === 2 ? day(30) : `${y}-12-31`,
        warehouseIds: ["wh-0"],
        status: i === 2 ? "Active" : "Completed",
      };
      await s.put("demo", "seasons", season);
      const campaignId = "demo-intervention-" + y;
      await s.put("demo", "interventions", {
        id: campaignId,
        name: `DEMO ${y} RICE EXTENSION`,
        programId: "pr-wet",
        organizationId: "org-kebbi",
        seasonId: id,
        warehouseId: "wh-0",
        type: "Seed support",
        crop: "Rice",
        dateApplied: season.startDate,
        status: i === 2 ? "In Progress" : "Completed",
      });
      const [state, lga, lat, lng] =
        i === 0
          ? ["Kano", "Kura", 11.77, 8.43]
          : i === 1
            ? ["Niger", "Bida", 9.08, 6.01]
            : ["Kebbi", "Birnin Kebbi", 12.45, 4.2];
      const locationId = "demo-site-" + y;
      await s.put("demo", "farmLocations", {
        id: locationId,
        farmerId: "demo-farmer-1",
        programId: "pr-wet",
        organizationId: "org-kebbi",
        seasonId: id,
        interventionId: campaignId,
        state,
        lga,
        crop: "Rice",
        latitude: lat,
        longitude: lng,
        address: "DEMONSTRATION FARM SITE",
        farmSize: 2,
        observedAt: i === 2 ? day(-20) : `${y}-09-01`,
        captureMethod: "Synthetic demonstration",
        notes: "Synthetic location; not a real farmer survey.",
      });
      await s.put("demo", "participations", {
        id: "demo-participation-" + y,
        farmerId: "demo-farmer-1",
        programId: "pr-wet",
        organizationId: "org-kebbi",
        seasonId: id,
        interventionId: campaignId,
        state,
        lga,
        crop: "Rice",
        status: "Delivered",
        enrolledAt: season.startDate,
        source: "Synthetic demonstration",
      });
      await s.put("demo", "harvestTasks", {
        id: "demo-harvest-" + y,
        name: `DEMO ${y} MEASURED RICE HARVEST`,
        farmerId: "demo-farmer-1",
        programId: "pr-wet",
        organizationId: "org-kebbi",
        seasonId: id,
        interventionId: campaignId,
        locationId,
        warehouseId: "wh-0",
        stage: "Harvest",
        startDate: i === 2 ? day(-7) : `${y}-10-01`,
        endDate: i === 2 ? day(-6) : `${y}-10-02`,
        status: "Completed",
        actualYield: 4800 + i * 400,
        expectedYield: 5000,
        notes: "Synthetic measured outcome for demonstration.",
      });
      await s.put("demo", "fieldValidations", {
        id: "demo-validation-" + y,
        farmerId: "demo-farmer-1",
        programId: "pr-wet",
        organizationId: "org-kebbi",
        seasonId: id,
        interventionId: campaignId,
        state,
        lga,
        crop: "Rice",
        farmSize: 2,
        latitude: lat,
        longitude: lng,
        validationDate: i === 2 ? day(-20) : `${y}-09-01`,
        status: "Verified",
        notes: "Synthetic manager-approved evidence.",
      });
    }
    await s.put("demo", "harvestTasks", {
      id: "demo-upcoming-plan",
      name: "DEMO COHORT HARVEST READINESS",
      programId: "pr-wet",
      organizationId: "org-kebbi",
      seasonId: "demo-season-current",
      interventionId: "demo-intervention-" + year,
      warehouseId: "wh-0",
      stage: "Scouting",
      startDate: day(2),
      endDate: day(4),
      status: "Planned",
      assignedTo: "DEMO FIELD TEAM",
      notes: "Prepare the whole intervention cohort for harvest.",
    });
  });
}
