#!/usr/bin/env python3
"""Dependency-free source and candidate audit for the static website."""

from __future__ import annotations

import re
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://vvsherryvv.github.io"
PLACEHOLDER = "[OWNER ACTION REQUIRED: INSERT SUPPORT EMAIL]"
REQUIRED_ROUTES = {
    "/": ROOT / "index.html",
    "/privacy/": ROOT / "privacy/index.html",
    "/support/": ROOT / "support/index.html",
    "/zh/": ROOT / "zh/index.html",
    "/zh/privacy/": ROOT / "zh/privacy/index.html",
    "/zh/support/": ROOT / "zh/support/index.html",
}
SUPPORT_CONTACT_PAGES = [
    ROOT / "privacy/index.html",
    ROOT / "support/index.html",
    ROOT / "zh/privacy/index.html",
    ROOT / "zh/support/index.html",
]
FRANCHISE_TERMS = [
    "harry potter",
    "wizarding world",
    "warner bros",
    "hogwarts",
    "gryffindor",
    "slytherin",
    "hufflepuff",
    "ravenclaw",
    "quidditch",
    "dementor",
    "patronus",
]
APP_STORE_CLAIMS = [
    "available on the app store",
    "download on the app store",
    "get it on the app store",
    "now on the app store",
    "已在 app store 上架",
    "前往 app store 下载",
]
TEXT_SUFFIXES = {".html", ".css", ".js", ".xml", ".txt", ".md", ".yml", ".yaml", ".py", ".sh"}
PUBLIC_SUFFIXES = {".html", ".css", ".js", ".xml", ".txt"}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.attrs: list[tuple[str, dict[str, str]]] = []
        self.links: list[tuple[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.ids: set[str] = set()
        self.h1_count = 0
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        self.attrs.append((tag, values))
        if values.get("id"):
            self.ids.add(values["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self._in_title = True
        if tag == "a" and values.get("href"):
            self.links.append(("href", values["href"]))
        if tag in {"img", "script", "iframe", "source"} and values.get("src"):
            self.links.append(("src", values["src"]))
        if tag == "link" and values.get("href"):
            self.links.append(("href", values["href"]))
        if tag == "img":
            self.images.append(values)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()

    def first(self, tag_name: str, **expected: str) -> dict[str, str] | None:
        for tag, attrs in self.attrs:
            if tag == tag_name and all(attrs.get(key) == value for key, value in expected.items()):
                return attrs
        return None


def html_parser(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def route_to_file(route: str) -> Path:
    path = unquote(route)
    if path.endswith("/"):
        return ROOT / path.lstrip("/") / "index.html"
    candidate = ROOT / path.lstrip("/")
    if candidate.suffix:
        return candidate
    return candidate / "index.html"


def resolve_local(page: Path, value: str) -> tuple[Path | None, str]:
    parsed = urlparse(value)
    if parsed.scheme in {"mailto", "tel"}:
        return None, ""
    if parsed.scheme in {"http", "https"}:
        if f"{parsed.scheme}://{parsed.netloc}" != ORIGIN:
            return None, ""
        target = route_to_file(parsed.path or "/")
    elif parsed.scheme or value.startswith("//"):
        return None, ""
    elif parsed.path.startswith("/"):
        target = route_to_file(parsed.path)
    elif not parsed.path:
        target = page
    else:
        target = (page.parent / unquote(parsed.path)).resolve()
        if parsed.path.endswith("/"):
            target = target / "index.html"
    return target, parsed.fragment


def jpeg_dimensions(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        return None
    offset = 2
    while offset + 9 < len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        offset += 2
        if marker in {0xD8, 0xD9}:
            continue
        if offset + 2 > len(data):
            break
        length = struct.unpack(">H", data[offset:offset + 2])[0]
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
            return width, height
        offset += length
    return None


def audit(mode: str) -> int:
    errors: list[str] = []
    warnings: list[str] = []
    html_files = sorted(ROOT.glob("**/*.html"))
    text_files = sorted(path for path in ROOT.rglob("*") if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES and ".git" not in path.parts)
    public_text = sorted(path for path in text_files if path.suffix.lower() in PUBLIC_SUFFIXES)
    parsers: dict[Path, PageParser] = {}

    for route, path in REQUIRED_ROUTES.items():
        if not path.is_file():
            errors.append(f"missing required route {route}: {path.relative_to(ROOT)}")
    for required in [ROOT / "404.html", ROOT / "robots.txt", ROOT / "sitemap.xml", ROOT / ".nojekyll"]:
        if not required.is_file():
            errors.append(f"missing required file: {required.relative_to(ROOT)}")

    titles: dict[str, Path] = {}
    descriptions: dict[str, Path] = {}
    for path in html_files:
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        lowered = text.lower()
        parser = html_parser(path)
        parsers[path] = parser
        if not lowered.lstrip().startswith("<!doctype html>"):
            errors.append(f"{rel}: missing HTML5 doctype")
        html_tag = parser.first("html")
        if not html_tag or not html_tag.get("lang"):
            errors.append(f"{rel}: missing html lang")
        if parser.h1_count != 1:
            errors.append(f"{rel}: expected one h1, found {parser.h1_count}")
        if not parser.title:
            errors.append(f"{rel}: missing title")
        elif parser.title in titles:
            errors.append(f"{rel}: title duplicates {titles[parser.title].relative_to(ROOT)}")
        else:
            titles[parser.title] = path
        description = parser.first("meta", name="description")
        if not description or not description.get("content"):
            errors.append(f"{rel}: missing meta description")
        elif description["content"] in descriptions:
            errors.append(f"{rel}: description duplicates {descriptions[description['content']].relative_to(ROOT)}")
        else:
            descriptions[description["content"]] = path
        if not parser.first("meta", name="viewport"):
            errors.append(f"{rel}: missing viewport")
        if not parser.first("meta", **{"http-equiv": "Content-Security-Policy"}):
            errors.append(f"{rel}: missing Content Security Policy")
        if not parser.first("link", rel="canonical"):
            errors.append(f"{rel}: missing canonical URL")
        if not parser.first("link", rel="icon"):
            errors.append(f"{rel}: missing favicon")
        if not parser.first("main"):
            errors.append(f"{rel}: missing main landmark")
        if not parser.first("nav"):
            errors.append(f"{rel}: missing nav landmark")
        if parser.first("form"):
            errors.append(f"{rel}: forms are prohibited")
        if parser.first("iframe"):
            errors.append(f"{rel}: iframes are prohibited")
        for image in parser.images:
            if "alt" not in image:
                errors.append(f"{rel}: image missing alt attribute: {image.get('src', '<unknown>')}")
            if not image.get("width") or not image.get("height"):
                errors.append(f"{rel}: image missing width/height: {image.get('src', '<unknown>')}")
        for _, value in parser.links:
            target, fragment = resolve_local(path, value)
            if target is None:
                continue
            try:
                target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{rel}: link escapes repository: {value}")
                continue
            if not target.is_file():
                errors.append(f"{rel}: broken local reference: {value}")
                continue
            if fragment and target.suffix.lower() == ".html":
                target_parser = parsers.get(target) or html_parser(target)
                parsers[target] = target_parser
                if fragment not in target_parser.ids:
                    errors.append(f"{rel}: missing fragment #{fragment} in {target.relative_to(ROOT)}")

    for path in REQUIRED_ROUTES.values():
        if not path.is_file():
            continue
        parser = parsers.get(path) or html_parser(path)
        alternates = {(attrs.get("hreflang"), attrs.get("href")) for tag, attrs in parser.attrs if tag == "link" and attrs.get("rel") == "alternate"}
        if not {lang for lang, _ in alternates}.issuperset({"en", "zh-Hans", "x-default"}):
            errors.append(f"{path.relative_to(ROOT)}: incomplete hreflang alternates")

    combined_public = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in public_text).lower()
    for term in FRANCHISE_TERMS:
        if term in combined_public:
            errors.append(f"prohibited third-party entertainment term found: {term}")
    for claim in APP_STORE_CLAIMS:
        if claim in combined_public:
            errors.append(f"premature App Store availability claim found: {claim}")
    if re.search(r"(?:localStorage|sessionStorage|document\.cookie)", combined_public, re.IGNORECASE):
        errors.append("browser storage or cookies found in public source")
    if re.search(r"<(?:form|iframe)\b", combined_public, re.IGNORECASE):
        errors.append("form or iframe found in public source")
    for path in public_text:
        text = path.read_text(encoding="utf-8", errors="ignore")
        scrubbed = text.replace('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', "")
        if "http://" in scrubbed.lower():
            errors.append(f"{path.relative_to(ROOT)}: insecure HTTP reference")
        if re.search(r"<(?:script|img|iframe|source)[^>]+(?:src|srcset)=[\"']https?://", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: external runtime resource")
        if re.search(r"<link[^>]+(?:stylesheet|preload)[^>]+href=[\"']https?://", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: external style/font resource")

    secret_patterns = [
        r"/Users/[^\s<>'\"]+",
        r"/private/tmp/[^\s<>'\"]+",
        r"gh[opsu]_[A-Za-z0-9_]{20,}",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"Bearer\s+[A-Za-z0-9._-]{20,}",
    ]
    combined_source = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in text_files
        if path.resolve() != Path(__file__).resolve()
    )
    for pattern in secret_patterns:
        if re.search(pattern, combined_source, re.IGNORECASE):
            errors.append(f"secret or local path pattern found: {pattern}")

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8") if (ROOT / "sitemap.xml").is_file() else ""
    for route in REQUIRED_ROUTES:
        expected = f"{ORIGIN}{route}"
        if expected not in sitemap:
            errors.append(f"sitemap missing {expected}")

    screenshot_files = sorted((ROOT / "assets/images").glob("screenshot-*.jpg"))
    if len(screenshot_files) != 7:
        errors.append(f"expected 7 screenshot derivatives, found {len(screenshot_files)}")
    for path in screenshot_files:
        dimensions = jpeg_dimensions(path)
        if dimensions != (828, 1800):
            errors.append(f"{path.relative_to(ROOT)}: unexpected dimensions {dimensions}")
    image_files = sorted(path for path in ROOT.rglob("*") if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    private_markers = [b"Exif\x00\x00", b"GPSLatitude", b"GPSLongitude", b"/Users/", b"/private/tmp/", b"Photoshop 3.0", b"XML:com.adobe.xmp"]
    for path in image_files:
        data = path.read_bytes()
        for marker in private_markers:
            if marker in data:
                errors.append(f"{path.relative_to(ROOT)}: metadata marker {marker!r}")
        if path.stat().st_size > 1_500_000:
            errors.append(f"{path.relative_to(ROOT)}: image exceeds 1.5 MB")
    total_bytes = sum(path.stat().st_size for path in ROOT.rglob("*") if path.is_file() and ".git" not in path.parts)
    if total_bytes > 12_000_000:
        errors.append(f"site exceeds 12 MB ({total_bytes} bytes)")

    support_texts = [path.read_text(encoding="utf-8") for path in SUPPORT_CONTACT_PAGES if path.is_file()]
    placeholder_count = sum(text.count(PLACEHOLDER) for text in support_texts)
    if mode == "--source":
        if placeholder_count:
            warnings.append("owner support email is missing; candidate verification remains blocked")
        else:
            warnings.append("support placeholder removed; run candidate mode and confirm owner approval")
    else:
        if placeholder_count:
            errors.append("candidate contains owner support email placeholder")
        for path, text in zip(SUPPORT_CONTACT_PAGES, support_texts):
            if "mailto:" not in text:
                errors.append(f"{path.relative_to(ROOT)}: candidate contact must use an approved mailto link")

    if errors:
        print(f"site verification failed ({mode}):")
        for error in sorted(set(errors)):
            print(f"  ERROR: {error}")
        for warning in warnings:
            print(f"  WARNING: {warning}")
        return 1

    print(f"site verification passed ({mode})")
    print(f"  HTML pages: {len(html_files)}")
    print(f"  Required routes: {len(REQUIRED_ROUTES)}")
    print(f"  Screenshot derivatives: {len(screenshot_files)}")
    print(f"  Total static bytes: {total_bytes}")
    for warning in warnings:
        print(f"  WARNING: {warning}")
    return 0


if __name__ == "__main__":
    requested_mode = sys.argv[1] if len(sys.argv) > 1 else "--source"
    if requested_mode not in {"--source", "--candidate"}:
        print("usage: python3 Scripts/site_audit.py --source|--candidate", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(audit(requested_mode))
