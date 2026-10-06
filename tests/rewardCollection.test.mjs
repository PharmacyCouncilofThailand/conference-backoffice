// Run against next dev; PLAYWRIGHT_MODULE_PATH may point to the bundled runtime.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../conference-api/package.json", import.meta.url));
const credential = `PRIS-REWARD:${"a".repeat(64)}`;
const qrImage = await requireApi("qrcode").toDataURL(credential, { width: 720, margin: 5 });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : "playwright");
const origin = process.env.BACKOFFICE_TEST_URL || "http://localhost:3001";
const screenshots = process.env.REWARD_COLLECTION_SCREENSHOT_DIR;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [role, width, eventId, denied] of [
    ["admin", 1440, 1, false], ["staff", 390, 1, false], ["staff", 320, 2, true], ["disabled-staff", 390, 1, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript(({ role, qrImage }) => {
      localStorage.setItem("backoffice_token", `test.${btoa(JSON.stringify({ exp: 4102444800 }))}.test`);
      localStorage.setItem("backoffice_user", JSON.stringify({ id: 9, role: role === "disabled-staff" ? "staff" : role,
        firstName: "UI", lastName: "Test", email: "ui@example.test", assignedEvents: [{ id: 1, name: "PRIS 2026", code: "PRIS-2026" }] }));
      // Decode an actual QR from a canvas stream without using the operator's camera.
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 720;
        const image = new Image();
        image.src = qrImage;
        await image.decode();
        const draw = () => canvas.getContext("2d").drawImage(image, 0, 0);
        draw();
        const timer = setInterval(draw, 50);
        const stream = canvas.captureStream(20);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); window.cameraStopped = true; };
        return stream;
      };
    }, { role, qrImage });
    await context.route("**/zxing_reader.wasm", (route) => route.fulfill({
      path: new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
      contentType: "application/wasm", headers: { "access-control-allow-origin": "*" },
    }));
    const calls = [];
    let redeemed = false;
    const wheel = { id: "00000000-0000-4000-8000-000000000150", mainSessionId: 1, enabled: true, paused: true,
      version: 1, poolRevision: 1, collectionDeadline: null, configuration: { segments: [{
        id: "00000000-0000-4000-8000-000000000151", kind: "prize", name: { th: "ปากกา", en: "Pen" }, imageId: null, enabled: true, position: 0,
      }] } };
    let publishedDeadline;
    await context.route("**/api/backoffice/**", async (route) => {
      const url = new URL(route.request().url());
      const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      calls.push(url.pathname);
      let body;
      if (url.pathname === "/api/backoffice/events") {
        body = { events: [{ id: 1, eventName: "PRIS 2026" }, ...(role === "admin" ? [{ id: 2, eventName: "Another event" }] : [])] };
      } else if (url.pathname.endsWith("/publication")) {
        const payload = route.request().postDataJSON();
        publishedDeadline = payload.configuration.collectionDeadline;
        wheel.collectionDeadline = publishedDeadline;
        wheel.configuration = payload.configuration;
        wheel.version += 1;
        body = { version: wheel.version };
      } else if (url.pathname === "/api/backoffice/lucky-wheel/events/1") {
        body = { eventId: 1, wheel, segments: [{ ...wheel.configuration.segments[0], remaining: 1 }], audit: [] };
      } else if (url.pathname.endsWith("/spins")) {
        body = { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
      } else if (url.pathname.endsWith("/collection-access")) {
        if (role === "disabled-staff") return route.fulfill({ status: 403, headers, contentType: "application/json", body: JSON.stringify({ error: "Account has no collection access" }) });
        body = { eventId: Number(url.pathname.split("/").at(-2)), role };
      } else if (url.pathname.endsWith("/reward-lookups")) {
        body = { eventId: 1, spinId: "11111111-1111-4111-8111-111111111111", owner: { id: 11, firstName: "ผู้ทดสอบ", lastName: "ระบบรางวัล", email: "owner@example.test" },
          prize: { name: { th: "ปากกา", en: "Pen" }, awardedAt: "2026-10-06T04:00:00Z" }, status: redeemed ? "redeemed" : "open", claimGeneration: 1, redeemedAt: redeemed ? "2026-10-06T04:05:00Z" : null, redeemedBy: redeemed ? 9 : null, redeemedByName: redeemed ? "ผู้ยืนยัน คนเดิม" : null, collectionDeadline: null };
      } else if (url.pathname.endsWith("/redemption")) {
        const payload = route.request().postDataJSON();
        assert.equal(payload.identityChecked, true);
        assert.equal("collectionPoint" in payload, false);
        assert.equal("deliveredDetails" in payload, false);
        redeemed = true;
        body = { status: "redeemed" };
      } else throw new Error(`Unexpected collection request: ${url.pathname}`);
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/reward-collection?eventId=${eventId}`);
    if (denied) {
      await page.getByRole("alert").waitFor();
      assert.equal(await page.locator("#reward-collection-title").count(), 0);
      assert.ok(!calls.some((path) => path.endsWith("/reward-lookups")));
    } else {
      await page.getByRole("heading", { name: "ตรวจและส่งมอบของรางวัล", exact: true }).waitFor();
      assert.ok(await page.getByRole("link", { name: "ส่งมอบรางวัล", exact: true }).isVisible());
      assert.ok(await page.getByRole("button", { name: "กล้อง", exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (screenshots) await page.screenshot({ path: join(screenshots, `${role}-${width}.png`), fullPage: true });
      if (role === "staff") {
        await page.getByRole("button", { name: "กล้อง", exact: true }).click();
      } else {
        await page.getByPlaceholder("PRIS-REWARD:... หรือรหัสตัวอักษร").fill(credential);
        await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
      }
      await page.getByText("ผู้ทดสอบ ระบบรางวัล", { exact: true }).waitFor();
      assert.equal(await page.locator("video").count(), 0);
      assert.equal(await page.getByRole("button", { name: "กล้อง", exact: true }).count(), 0);
      assert.equal(await page.getByText("จุดส่งมอบจริง", { exact: true }).count(), 0);
      assert.equal(await page.getByText("รายละเอียดส่งมอบ (ถ้ามี)", { exact: true }).count(), 0);
      const confirm = page.getByRole("button", { name: "ยืนยันส่งมอบของรางวัล", exact: true });
      assert.ok(await confirm.isDisabled());
      await page.getByRole("checkbox", { name: "ตรวจสอบผู้รับแล้ว ชื่อและบัญชีตรงกับผู้ที่มารับของ" }).check();
      assert.ok(await confirm.isEnabled());
      if (role === "staff") await page.waitForFunction(() => window.cameraStopped === true);
      if (screenshots) await page.screenshot({ path: join(screenshots, `${role}-${width}-recipient.png`), fullPage: true });
      await confirm.click();
      await page.getByText("รับของแล้ว", { exact: true }).waitFor();
      await page.getByText(/ยืนยันโดย ผู้ยืนยัน คนเดิม เมื่อ/).waitFor();
      assert.equal(await page.getByRole("button", { name: "ต้องแก้ไขการรับของ?", exact: true }).count(), role === "admin" ? 1 : 0);
      await page.getByRole("button", { name: "ค้นหารายการถัดไป", exact: true }).click();
      if (role === "staff") {
        // The same QR can be scanned again and stays redeemed.
        await page.getByText("ผู้ทดสอบ ระบบรางวัล", { exact: true }).waitFor();
        await page.getByText("รับของแล้ว", { exact: true }).waitFor();
        assert.equal(await page.getByRole("checkbox").count(), 0);
      }
      if (role === "admin") {
        await page.getByLabel("Event ที่กำลังส่งมอบ").selectOption("2");
        await page.getByRole("heading", { name: "ตรวจและส่งมอบของรางวัล", exact: true }).waitFor();
        assert.equal(await page.getByPlaceholder("PRIS-REWARD:... หรือรหัสตัวอักษร").inputValue(), "");
        assert.equal(new URL(page.url()).searchParams.get("eventId"), "2");
        assert.equal(await page.getByText("ผู้ทดสอบ ระบบรางวัล", { exact: true }).count(), 0);
        await page.goto(`${origin}/lucky-wheel`);
        const deadline = page.getByLabel("กำหนดรับของ (เวลาไทย)", { exact: false });
        await deadline.fill("2026-10-30T18:30");
        await page.getByRole("button", { name: "บันทึกและเผยแพร่", exact: true }).click();
        await page.getByText("ข้อมูลตรงกับ server · v2", { exact: true }).waitFor();
        assert.equal(publishedDeadline, "2026-10-30T11:30:00.000Z");
        assert.equal(await deadline.inputValue(), "2026-10-30T18:30");
        if (screenshots) await page.screenshot({ path: join(screenshots, "admin-deadline.png"), fullPage: true });
        await deadline.fill("");
        await page.getByRole("button", { name: "บันทึกและเผยแพร่", exact: true }).click();
        await page.getByText("ข้อมูลตรงกับ server · v3", { exact: true }).waitFor();
        assert.equal(publishedDeadline, null);
      }
    }
    await context.close();
  }
  for (const [role, destination] of [["organizer", "members"], ["reviewer", "abstracts"], ["verifier", "verification"]]) {
    const context = await browser.newContext();
    await context.addInitScript(({ role }) => {
      localStorage.setItem("backoffice_token", `test.${btoa(JSON.stringify({ exp: 4102444800 }))}.test`);
      localStorage.setItem("backoffice_user", JSON.stringify({ id: 9, role, firstName: "UI", lastName: "Test", email: "ui@example.test", assignedEvents: [] }));
    }, { role });
    await context.route("**/api/**", (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) }));
    const page = await context.newPage();
    await page.goto(`${origin}/reward-collection`);
    await page.waitForURL(`**/${destination}`);
    assert.equal(await page.locator("#reward-collection-title").count(), 0);
    await context.close();
  }
  console.log("Collection UI passed: QR scan stops camera, recipient verification without handover fields, next scan, role restrictions and event isolation.");
} finally {
  await browser.close();
}
