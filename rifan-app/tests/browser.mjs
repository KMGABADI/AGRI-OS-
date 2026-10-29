import { chromium } from "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const testPhone = "080" + String(Date.now()).slice(-8);
const uploadPhone = "081" + String(Date.now()).slice(-8);
const origin = process.env.RIFAN_TEST_ORIGIN || "http://127.0.0.1:3002";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Explore the demo workspace" })
    .click();
  await page
    .getByRole("heading", { name: "Growing stronger, together." })
    .waitFor();
  const routes = [
    ["/farmers", "Farmer registry."],
    ["/membership", "Members & fees."],
    ["/orgs", "Cooperatives & partners."],
    ["/warehouses", "Warehouses."],
    ["/monitoring", "Programmes & impact."],
    ["/programs", "Programmes."],
    ["/calendar", "Harvest planner."],
    ["/upload", "Data hub."],
    ["/reports", "Reports & insights."],
    ["/connections", "Connections."],
    ["/food-bank", "Food bank."],
    ["/advisor", "Farm advisor."],
    ["/alerts", "Alerts & follow-ups."],
    ["/settings", "Workspace settings."],
    ["/users", "Team & access."],
    ["/activity", "Audit trail."],
    ["/profile", "My account."],
    ["/map", "Farm intelligence."],
  ];
  for (const [path, heading] of routes) {
    await page.goto(origin + path);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.equal(await page.locator(".page-watermark").count(), 1);
    console.log("PASS route " + path);
  }
  await page.goto(origin + "/farmers");
  await page
    .getByRole("button", { name: "Register farmer", exact: true })
    .click();
  await page.getByLabel("First name").fill("Browser");
  await page.getByLabel("Last name").fill("Fixture");
  await page.locator("#field-gender").selectOption("Female");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("#field-primaryPhone").fill(testPhone);
  await page.locator("#field-country").selectOption("Nigeria");
  await page.getByLabel("State / region").selectOption("Kano");
  await page.getByLabel("LGA / department").selectOption("Kura");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Primary crop").selectOption("Rice");
  await page.getByLabel("Farm size (hectares)").fill("2.5");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("textbox", { name: "Search name, member ID or phone…" })
    .fill("Browser Fixture");
  await page
    .getByRole("button", { name: /BROWSER FIXTURE/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: /BROWSER FIXTURE/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "BROWSER FIXTURE.", exact: true })
    .waitFor();
  console.log("PASS multi-step farmer registration and uppercase persistence");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Member ID", exact: true }).click();
  const id = await download;
  assert.ok(id.suggestedFilename().endsWith("-id.pdf"));
  await id.saveAs("/tmp/rifan-single-id.pdf");
  console.log("PASS watermarked member ID PDF download");
  await page.goto(origin + "/farmers");
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("checkbox").nth(2).check();
  const bulkDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Bulk PDF", exact: true }).click();
  const bulk = await bulkDownload;
  await bulk.saveAs("/tmp/rifan-bulk-ids.pdf");
  const zipDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Individual PDFs (ZIP)", exact: true })
    .click();
  const zip = await zipDownload;
  await zip.saveAs("/tmp/rifan-bulk-ids.zip");
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print cards", exact: true }).click();
  const popup = await popupEvent;
  await popup.locator(".member-id-card").first().waitFor();
  assert.equal(await popup.locator(".member-id-card").count(), 2);
  await popup.evaluate(() => {
    window.__printCalled = false;
    window.print = () => {
      window.__printCalled = true;
    };
  });
  await popup.getByRole("button", { name: "Print cards", exact: true }).click();
  await popup.waitForFunction(() => window.__printCalled === true);
  await popup.emulateMedia({ media: "print" });
  await popup.pdf({
    path: "/tmp/rifan-card-print-sheet.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await popup.close();
  console.log(
    "PASS bulk PDF, individual PDF ZIP and direct card print invocation",
  );
  await page.goto(origin + "/upload");
  const text = `firstName,lastName,gender,primaryPhone,state,lga,crop,farmSize\r\nUpload,Fixture,Female,${uploadPhone},Kano,Kura,Rice,3\r\nInvalid,Fixture,Female,BADPHONE,Kano,Kura,Rice,3\r\n`;
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-upload.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(text),
  });
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page
    .getByRole("heading", { name: "Review before you import" })
    .waitFor();
  await page.getByRole("button", { name: "Import full register" }).click();
  await page.getByRole("heading", { name: "Import completed" }).waitFor();
  console.log("PASS browser CSV mapping, validation, archive and commit");
  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Growing stronger, together." })
    .waitFor();
  await page.screenshot({
    path: "/tmp/rifan-desktop-tested.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("heading", { name: "Growing stronger, together." })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Data hub", exact: true }).click();
  await page.getByRole("heading", { name: "Data hub.", exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.waitForFunction(() => {
    const el = document.querySelector(".sidebar");
    return (
      el &&
      !el.classList.contains("open") &&
      el.getBoundingClientRect().right <= 1
    );
  });
  await page.screenshot({
    path: "/tmp/rifan-mobile-tested.png",
    fullPage: true,
  });
  console.log("PASS mobile navigation and layout without horizontal overflow");
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
} finally {
  await browser.close();
}
