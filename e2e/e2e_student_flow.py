import json, re, time, urllib.request, random
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:5173"
def api(path):
    return json.load(urllib.request.urlopen(BASE + "/api" + path))

results = []
def step(name):
    def deco(fn):
        t = time.time()
        try:
            fn(); results.append((name, "PASS", round(time.time()-t,1)))
        except Exception as e:
            results.append((name, "FAIL: " + str(e)[:300].replace("\n"," "), round(time.time()-t,1)))
    return deco

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width":1280,"height":900}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    page.on("console", lambda m: errors.append("console:"+m.text[:200]) if m.type=="error" else None)

    @step("catalog loads 8 courses on page 1 with hero")
    def _():
        page.goto(BASE + "/")
        expect(page.get_by_role("heading", name="Pick a course. Show up to class.")).to_be_visible()
        page.wait_for_selector("article")
        assert page.locator("article").count() == 8, page.locator("article").count()
        page.screenshot(path="/tmp/e2e/01-home.png", full_page=False)

    @step("search narrows results; clear filters restores")
    def _():
        page.get_by_label("Search courses").fill("react")
        page.get_by_role("button", name="Search").click()
        page.wait_for_function("document.querySelectorAll('article').length === 1")
        assert "React 19" in page.locator("article").inner_text()
        page.get_by_role("button", name="Clear filters").click()
        page.wait_for_function("document.querySelectorAll('article').length === 8")

    @step("filter free courses + pagination")
    def _():
        page.get_by_label("Price").select_option("0")
        page.wait_for_function("document.querySelectorAll('article').length === 3")
        page.get_by_role("button", name="Clear filters").click()
        page.wait_for_function("document.querySelectorAll('article').length === 8")
        page.get_by_role("button", name="Next").click()
        page.wait_for_function("document.querySelectorAll('article').length === 4")
        assert "Page 2 of 2" in page.inner_text("body")

    email = f"e2e{random.randint(1000,9999)}@test.dev"
    @step("register new student via UI -> dashboard")
    def _():
        page.goto(BASE + "/register")
        page.get_by_label("Full name").fill("Kavya Nair")
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password (8+ characters)").fill("Passw0rd!x")
        page.get_by_role("button", name="Create account").click()
        page.wait_for_url("**/dashboard")
        expect(page.get_by_role("heading", name=re.compile("Hi Kavya"))).to_be_visible()
        page.screenshot(path="/tmp/e2e/02-dashboard-empty.png")

    node = api("/courses?q=Node.js")["items"][0]
    @step("course detail shows outline + free preview link for a paid course")
    def _():
        page.goto(f"{BASE}/courses/{node['slug']}")
        expect(page.get_by_role("button", name=re.compile("Buy for"))).to_be_visible()
        assert page.get_by_role("link", name="Free preview").count() == 1
        page.screenshot(path="/tmp/e2e/03-course-detail.png")

    @step("free preview lesson: HLS master + segments are fetched via signed URLs")
    def _():
        hits = {"m3u8": 0, "ts": 0}
        def on_resp(r):
            if "/api/media/" in r.url and r.status == 200:
                if ".m3u8" in r.url: hits["m3u8"] += 1
                if ".ts" in r.url: hits["ts"] += 1
        page.on("response", on_resp)
        page.get_by_role("link", name="Free preview").click()
        page.wait_for_selector("video", state="attached")
        page.wait_for_timeout(8000)
        supported = page.evaluate("window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs=\"avc1.4d401f,mp4a.40.2\"')")
        state = page.evaluate("(() => { const v=document.querySelector('video'); return {ready:v.readyState,w:v.videoWidth,t:v.currentTime}; })()")
        results.append(("   info: this test browser decodes H.264=%s, video=%s, signed HLS requests=%s" % (supported, state, hits), "INFO", 0))
        assert hits["m3u8"] >= 2, hits
        if supported:
            assert hits["ts"] >= 1 and state["ready"] >= 2 and state["w"] in (640, 1280), (hits, state)
        page.screenshot(path="/tmp/e2e/04-preview-player.png")

    js = api("/courses?q=JavaScript")["items"][0]
    @step("enroll in a free course -> learn page")
    def _():
        page.goto(f"{BASE}/courses/{js['slug']}")
        page.get_by_role("button", name="Enroll for free").click()
        page.wait_for_url(re.compile(r".*/learn/.*"))
        expect(page.get_by_text("Your progress")).to_be_visible()
        page.screenshot(path="/tmp/e2e/05-learn.png")

    @step("complete all 8 lessons -> progress 100%")
    def _():
        for i in range(8):
            page.get_by_role("button", name="Mark as complete").click()
            page.wait_for_selector("text=Completed")
            if i < 7: page.get_by_role("button", name="Next lesson").click()
        page.wait_for_function("document.body.innerText.includes('100%')")

    @step("take the quiz through the UI and pass (auto-graded)")
    def _():
        page.get_by_role("tab", name=re.compile("Quizzes")).click()
        page.get_by_role("link", name="Start quiz").click()
        page.wait_for_selector("ol li")
        page.get_by_label("POST").check()
        page.get_by_label("200").check(); page.get_by_label("201").check()
        page.get_by_label("True").check()
        page.get_by_role("button", name="Submit answers").click()
        expect(page.get_by_text(re.compile("Passed: 100%"))).to_be_visible()
        page.screenshot(path="/tmp/e2e/06-quiz-passed.png")

    cert = {}
    @step("certificate: issue, download real PDF, verify publicly")
    def _():
        page.get_by_role("link", name="Back to lessons").click()
        page.wait_for_selector("text=Your progress")
        page.get_by_role("tab", name="Certificate").click()
        page.get_by_role("button", name="Get my certificate").click()
        expect(page.get_by_role("button", name="Download PDF")).to_be_visible()
        with page.expect_download() as d:
            page.get_by_role("button", name="Download PDF").click()
        path = d.value.path()
        data = open(path, "rb").read()
        assert data[:5] == b"%PDF-" and len(data) > 1500, len(data)
        cid = re.search(r"LS-[0-9A-F]{12}", page.inner_text("body")).group(0)
        cert["id"] = cid
        page.goto(f"{BASE}/verify/{cid}")
        expect(page.get_by_text("Valid certificate")).to_be_visible()
        expect(page.get_by_role("heading", name="Kavya Nair")).to_be_visible()
        page.screenshot(path="/tmp/e2e/07-verify.png")

    @step("dashboard now shows 100% course and certificate")
    def _():
        page.goto(BASE + "/dashboard")
        page.wait_for_selector("text=100%")
        assert cert["id"] in page.inner_text("body")

    @step("route guards: logged-out user is sent to login; student blocked from /instructor")
    def _():
        page.goto(BASE + "/instructor")
        expect(page.get_by_text("You don’t have access to this page")).to_be_visible()
        page.get_by_role("button", name="Log out").click()
        page.goto(BASE + "/dashboard")
        page.wait_for_url("**/login")

    @step("login error message for wrong password")
    def _():
        page.get_by_label("Email").fill("student@learnsphere.dev")
        page.get_by_label("Password").fill("wrong-password")
        page.get_by_role("button", name="Log in").click()
        expect(page.get_by_role("alert")).to_contain_text("Invalid email or password")

    b.close()

for n, r, t in results:
    print(f"{r[:4] if r.startswith(('PASS','FAIL')) else r:5} {n} ({t}s)" + ("" if r in ("PASS","INFO") else "  -> " + r))
print("browser errors:", [e for e in errors if "favicon" not in e][:6])
