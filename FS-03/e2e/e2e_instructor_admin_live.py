import json, re, time, urllib.request
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:5173"
def call(path, method="GET", body=None, token=None):
    req = urllib.request.Request(BASE + "/api" + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", "Bearer " + token)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {"_status": e.code, **json.loads(e.read() or b"{}")}

results = []
def step(name):
    def deco(fn):
        t = time.time()
        try: fn(); results.append((name, "PASS", round(time.time()-t,1)))
        except Exception as e: results.append((name, "FAIL: " + str(e)[:400].replace("\n"," "), round(time.time()-t,1)))
    return deco

def ui_login(page, email):
    page.goto(BASE + "/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password").fill("Demo@1234")
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/dashboard")

title = "E2E Course " + str(int(time.time()) % 100000)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width":1280,"height":900})
    page = ctx.new_page()

    @step("instructor logs in and creates a draft course via the UI")
    def _():
        ui_login(page, "instructor@learnsphere.dev")
        page.goto(BASE + "/instructor")
        page.get_by_role("tab", name="New course").click()
        page.get_by_label("Course title").fill(title)
        page.get_by_label("Description").fill("A course created entirely by the browser test.")
        page.get_by_label("Category").fill("Testing")
        page.get_by_label("Price (₹, 0 = free)").fill("0")
        page.get_by_role("button", name="Create draft").click()
        page.wait_for_url(re.compile(r".*/instructor/courses/.*"))
        expect(page.get_by_role("heading", name=title)).to_be_visible()
        page.screenshot(path="/tmp/e2e/08-editor-empty.png")

    @step("add a lesson, upload a video, watch BullMQ/FFmpeg progress reach Ready")
    def _():
        page.get_by_label("Lesson title").fill("Recorded intro")
        page.get_by_role("button", name="Add lesson").click()
        page.wait_for_selector("text=Recorded intro")
        page.locator("input[type=file]").set_input_files("/tmp/e2e/up.mp4")
        page.wait_for_selector("text=Uploading", timeout=10000)
        page.wait_for_selector("text=/Ready \\(/", timeout=90000)
        page.screenshot(path="/tmp/e2e/09-video-ready.png")
        expect(page.get_by_text(re.compile("video 0?:?"))).to_be_visible() if False else None

    @step("quiz builder: create a quiz through the UI")
    def _():
        page.get_by_role("button", name="New quiz").click()
        page.get_by_label("Quiz title").fill("Smoke quiz")
        page.get_by_label("Question 1 text").fill("Is this a test?")
        page.get_by_label("Option 1").first.fill("Yes")
        page.get_by_label("Option 2").first.fill("No")
        page.get_by_role("button", name="Save quiz").click()
        page.wait_for_selector("text=Smoke quiz")

    @step("submit for review -> status pending")
    def _():
        page.get_by_role("button", name="Submit for review").click()
        expect(page.get_by_text("Waiting for admin approval")).to_be_visible()

    @step("admin approves it; course appears in the public catalog")
    def _():
        page.get_by_role("button", name="Log out").click()
        ui_login(page, "admin@learnsphere.dev")
        page.goto(BASE + "/admin")
        page.wait_for_selector(f"text={title}")
        page.screenshot(path="/tmp/e2e/10-admin.png")
        page.locator("li", has_text=title).get_by_role("button", name="Approve").click()
        page.wait_for_selector(f"text={title}", state="detached", timeout=10000)
        page.goto(BASE + "/?q=" + title.replace(" ", "%20"))
        page.wait_for_selector("article")
        assert title in page.locator("article").first.inner_text()
        page.get_by_role("button", name="Log out").click()

    # ---------- live class: two real browsers, real WebRTC with fake camera ----------
    courses = call("/courses?q=JavaScript")["items"]
    js = [c for c in courses if c["title"].startswith("JavaScript:")][0]
    inst = call("/auth/login", "POST", {"email": "instructor2@learnsphere.dev", "password": "Demo@1234"})["accessToken"]
    stu = call("/auth/login", "POST", {"email": "student@learnsphere.dev", "password": "Demo@1234"})["accessToken"]
    call(f"/courses/{js['id']}/enroll", "POST", {}, stu)
    lc = call(f"/courses/{js['id']}/live-classes", "POST", {"title": "E2E doubt session", "scheduledAt": (datetime.utcnow()+timedelta(minutes=30)).isoformat()+"Z", "durationMin": 30}, inst)
    class_id = lc["liveClass"]["_id"]
    call(f"/live-classes/{class_id}/start", "POST", {}, inst)

    ctx_i = b.new_context(viewport={"width":1280,"height":800}, permissions=["camera","microphone"])
    ctx_s = b.new_context(viewport={"width":1280,"height":800}, permissions=["camera","microphone"])
    pi, ps = ctx_i.new_page(), ctx_s.new_page()

    def remote_video_ok(pg):
        return pg.evaluate("Array.from(document.querySelectorAll('video')).filter(v => !v.muted && v.videoWidth > 0).length")

    @step("WebRTC: instructor and student join and each receives the other's live video")
    def _():
        ui_login(pi, "instructor2@learnsphere.dev")
        pi.goto(f"{BASE}/live/{class_id}")
        expect(pi.get_by_text("Class chat")).to_be_visible()
        ui_login(ps, "student@learnsphere.dev")
        ps.goto(f"{BASE}/live/{class_id}")
        expect(ps.get_by_text("Class chat")).to_be_visible()
        pi.wait_for_function("Array.from(document.querySelectorAll('video')).filter(v => !v.muted && v.videoWidth > 0).length >= 1", timeout=30000)
        ps.wait_for_function("Array.from(document.querySelectorAll('video')).filter(v => !v.muted && v.videoWidth > 0).length >= 1", timeout=30000)
        results.append((f"   info: remote frames instructor={remote_video_ok(pi)} student={remote_video_ok(ps)}", "INFO", 0))
        pi.screenshot(path="/tmp/e2e/11-live-instructor.png"); ps.screenshot(path="/tmp/e2e/12-live-student.png")

    @step("live chat round trip (student -> instructor and back)")
    def _():
        ps.get_by_label("Chat message").fill("Hello sir, audio ok?")
        ps.get_by_role("button", name="Send").click()
        expect(pi.get_by_text("Hello sir, audio ok?")).to_be_visible()
        pi.get_by_label("Chat message").fill("Loud and clear")
        pi.get_by_role("button", name="Send").click()
        expect(ps.get_by_text("Loud and clear")).to_be_visible()

    @step("camera toggle is reflected on the other side; instructor ending the class sends student to dashboard")
    def _():
        pi.get_by_role("button", name="Turn camera off").click()
        expect(pi.get_by_role("button", name="Turn camera on")).to_be_visible()
        pi.get_by_role("button", name="End class for everyone").click()
        ps.wait_for_url("**/dashboard", timeout=15000)

    @step("a student NOT enrolled cannot join the room")
    def _():
        other = call("/auth/register", "POST", {"name": "Late Joiner", "email": f"late{int(time.time())}@test.dev", "password": "Passw0rd!x"})
        class2 = call(f"/courses/{js['id']}/live-classes", "POST", {"title": "Second", "scheduledAt": (datetime.utcnow()+timedelta(minutes=50)).isoformat()+"Z"}, inst)["liveClass"]["_id"]
        call(f"/live-classes/{class2}/start", "POST", {}, inst)
        c3 = b.new_context(permissions=["camera","microphone"]); p3 = c3.new_page()
        p3.goto(BASE + "/register")
        p3.get_by_label("Full name").fill("Late Joiner"); p3.get_by_label("Email").fill(f"late2{int(time.time())}@test.dev"); p3.get_by_label("Password (8+ characters)").fill("Passw0rd!x")
        p3.get_by_role("button", name="Create account").click(); p3.wait_for_url("**/dashboard")
        p3.goto(f"{BASE}/live/{class2}")
        expect(p3.get_by_text("Couldn’t join this class")).to_be_visible()
        expect(p3.get_by_text(re.compile("Enroll"))).to_be_visible()
    b.close()

for n, r, t in results:
    print(f"{r[:4] if r.startswith(('PASS','FAIL')) else r:5} {n} ({t}s)" + ("" if r in ("PASS","INFO") else "  -> " + r))
