"""Capture preview screenshots from the local wrangler app. Example data only."""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/lifts-coach/phase1/screenshots")
OUT.mkdir(parents=True, exist_ok=True)

FIVE = [5, 5, 5, 5, 5]


def api(method: str, path: str, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={"content-type": "application/json", "accept": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        raw = res.read()
        return json.loads(raw.decode()) if raw else None


def reset_today_draft():
    api(
        "PUT",
        "/api/draft",
        {
            "draft": {
                "kind": "B",
                "entries": {
                    "squat": {"weight": 140, "sets": [None, None, None, None, None], "notes": "", "confirmed": False, "overrideOpen": False},
                    "ohp": {"weight": 65, "sets": [None, None, None, None, None], "notes": "", "confirmed": False, "overrideOpen": False},
                    "deadlift": {"weight": 185, "sets": [None], "notes": "", "confirmed": False, "overrideOpen": False},
                },
            }
        },
    )


def seed():
    state = api("GET", "/api/state")
    if state["store"]["sessions"]:
        reset_today_draft()
        return
    api(
        "POST",
        "/api/starting-weights",
        {"weights": {"squat": 135, "bench": 95, "row": 95, "ohp": 65, "deadlift": 185}},
    )
    api(
        "POST",
        "/api/workouts",
        {
            "kind": "A",
            "completedAt": "2026-11-10T16:00:00Z",
            "lifts": [
                {"lift": "squat", "prescribedWeight": 135, "prescribedSets": 5, "prescribedReps": 5, "weight": 135, "sets": FIVE, "notes": ""},
                {"lift": "bench", "prescribedWeight": 95, "prescribedSets": 5, "prescribedReps": 5, "weight": 95, "sets": FIVE, "notes": ""},
                {"lift": "row", "prescribedWeight": 95, "prescribedSets": 5, "prescribedReps": 5, "weight": 95, "sets": FIVE, "notes": ""},
            ],
        },
    )


def stamp(page):
    page.evaluate(
        """
        () => {
          if (document.getElementById('example-banner')) return;
          const b = document.createElement('div');
          b.id = 'example-banner';
          b.textContent = 'EXAMPLE DATA for preview. Not Jake\\u2019s weights.';
          b.setAttribute('style',
            'position:fixed;top:0;left:0;right:0;z-index:9999;background:#F5B83D;color:#000;font:700 11px/1.3 "HUD Sans",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;text-align:center;pointer-events:none;');
          document.body.style.paddingTop = '36px';
          document.body.appendChild(b);
        }
        """
    )


def shot(page, name):
    stamp(page)
    page.wait_for_timeout(200)
    dest = OUT / f"{name}.png"
    page.screenshot(path=str(dest), full_page=True)
    print(dest)


def main():
    seed()
    viewports = {"mobile": {"width": 390, "height": 844}, "desktop": {"width": 1280, "height": 800}}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for size, vp in viewports.items():
            for theme in ("dark", "light"):
                context = browser.new_context(
                    viewport=vp,
                    device_scale_factor=2 if size == "mobile" else 1,
                    color_scheme=theme,
                )
                page = context.new_page()
                page.add_init_script(f"localStorage.setItem('lifts-theme', '{theme}');")
                reset_today_draft()
                page.goto(BASE + "/", wait_until="networkidle")
                page.wait_for_selector("button[data-action='done']")
                shot(page, f"today-{size}-{theme}")

                page.locator('[data-action="override"]').first.click()
                page.wait_for_selector(".override")
                shot(page, f"today-override-{size}-{theme}")

                page.get_by_role("tab", name="History").click()
                page.wait_for_selector(".history, .weight-list")
                shot(page, f"history-{size}-{theme}")

                page.get_by_role("tab", name="Settings").click()
                page.wait_for_selector("#bar-weight")
                shot(page, f"settings-{size}-{theme}")
                context.close()
        browser.close()


if __name__ == "__main__":
    main()
