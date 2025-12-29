#!/usr/bin/env python3

import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_DIR = DATA_DIR / "generated"

CLUSTERS_CSV = DATA_DIR / "elon-musk_clusters.csv"
PAA_CSV = DATA_DIR / "google-paa-elon-musk-level8-23-12-2025.csv"
QUESTIONS_CSV = DATA_DIR / "elon-musk_broad-match_us_question.csv"


def slugify(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:255] or "untitled"


def normalize_question(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s


def safe_int(value: Optional[str], default: int = 0) -> int:
    if value is None:
        return default
    s = value.strip()
    if s == "":
        return default
    try:
        return int(float(s))
    except Exception:
        return default


@dataclass
class KeywordDatum:
    keyword: str
    volume: int
    kd: int
    intent: str
    cpc: str
    serp_features: str


def read_question_volumes(path: Path) -> Dict[str, int]:
    mapping: Dict[str, int] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            keyword = (row.get("Keyword") or "").strip()
            if not keyword:
                continue
            volume = safe_int(row.get("Volume"))
            mapping[normalize_question(keyword)] = volume
    return mapping


def build_cluster_indexes(path: Path) -> Dict[str, Any]:
    pages: Dict[str, Dict[str, Any]] = {}
    topics: Dict[str, Dict[str, Any]] = {}

    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            page = (row.get("Page") or "").strip()
            topic = (row.get("Topic") or "").strip()
            page_type = (row.get("Page type") or "").strip()
            seed = (row.get("Seed keyword") or "").strip()
            keyword = (row.get("Keyword") or "").strip()

            if not topic or not page:
                continue

            topic_slug = slugify(topic)
            page_slug = slugify(page)
            full_slug = f"{topic_slug}/{page_slug}"

            if topic_slug not in topics:
                topics[topic_slug] = {
                    "slug": topic_slug,
                    "topic": topic,
                    "pageCount": 0,
                    "totalVolume": 0,
                    "pages": [],
                }

            if full_slug not in pages:
                pages[full_slug] = {
                    "slug": full_slug,
                    "topicSlug": topic_slug,
                    "topic": topic,
                    "pageSlug": page_slug,
                    "page": page,
                    "pageType": page_type or None,
                    "seedKeyword": seed or None,
                    "tags": (row.get("Tags") or "").strip() or None,
                    "keywordCount": 0,
                    "maxVolume": 0,
                    "totalVolume": 0,
                    "minKd": None,
                    "maxKd": None,
                    "topKeywords": [],
                }
                topics[topic_slug]["pages"].append(full_slug)

            volume = safe_int(row.get("Volume"))
            kd = safe_int(row.get("Keyword Difficulty"))
            pages[full_slug]["keywordCount"] += 1
            pages[full_slug]["totalVolume"] += volume
            pages[full_slug]["maxVolume"] = max(pages[full_slug]["maxVolume"], volume)
            if pages[full_slug]["minKd"] is None:
                pages[full_slug]["minKd"] = kd
                pages[full_slug]["maxKd"] = kd
            else:
                pages[full_slug]["minKd"] = min(pages[full_slug]["minKd"], kd)
                pages[full_slug]["maxKd"] = max(pages[full_slug]["maxKd"], kd)

            topics[topic_slug]["totalVolume"] += volume

            if keyword:
                pages[full_slug]["topKeywords"].append(
                    KeywordDatum(
                        keyword=keyword,
                        volume=volume,
                        kd=kd,
                        intent=(row.get("Intent") or "").strip(),
                        cpc=(row.get("CPC (USD)") or "").strip(),
                        serp_features=(row.get("SERP Features") or "").strip(),
                    ).__dict__,
                )

    # Sort keywords and cap to top 20 per page to keep JSON small
    for page in pages.values():
        page["topKeywords"].sort(key=lambda k: (k.get("volume", 0), -k.get("kd", 0)), reverse=True)
        page["topKeywords"] = page["topKeywords"][:20]

    # Finalize topics
    for topic in topics.values():
        topic["pageCount"] = len(topic["pages"])

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(path.relative_to(ROOT)),
        "topics": sorted(topics.values(), key=lambda t: t["totalVolume"], reverse=True),
        "pages": sorted(pages.values(), key=lambda p: p["maxVolume"], reverse=True),
    }


def build_paa_index(paa_path: Path, volume_map: Dict[str, int]) -> Dict[str, Any]:
    seen: set[str] = set()
    questions: List[Dict[str, Any]] = []
    with paa_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("PAA Title") or "").strip()
            if not title:
                continue
            slug = slugify(title)
            if slug in seen:
                continue
            seen.add(slug)
            parent = (row.get("Parent") or "").strip() or None
            answer = (row.get("Text") or "").strip() or None
            source_url = (row.get("URL") or "").strip() or None
            source_title = (row.get("URL Title") or "").strip() or None
            volume = volume_map.get(normalize_question(title), 0)
            questions.append(
                {
                    "slug": slug,
                    "question": title,
                    "parent": parent,
                    "answer": answer,
                    "sourceUrl": source_url,
                    "sourceTitle": source_title,
                    "volume": volume,
                }
            )

    questions.sort(key=lambda q: q.get("volume", 0), reverse=True)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(paa_path.relative_to(ROOT)),
        "questions": questions,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    volume_map = read_question_volumes(QUESTIONS_CSV) if QUESTIONS_CSV.exists() else {}
    cluster = build_cluster_indexes(CLUSTERS_CSV)
    paa = build_paa_index(PAA_CSV, volume_map)

    write_json(OUT_DIR / "cluster-index.json", cluster)
    write_json(OUT_DIR / "paa-index.json", paa)

    top_pages = [p["slug"] for p in cluster["pages"][:50]]
    write_json(
        OUT_DIR / "top-pages.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": str(CLUSTERS_CSV.relative_to(ROOT)),
            "count": len(top_pages),
            "slugs": top_pages,
        },
    )

    top_questions = [q["slug"] for q in paa["questions"][:50]]
    write_json(
        OUT_DIR / "top-questions.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": str(PAA_CSV.relative_to(ROOT)),
            "count": len(top_questions),
            "slugs": top_questions,
        },
    )

    print("Wrote:")
    print("-", str((OUT_DIR / "cluster-index.json").relative_to(ROOT)))
    print("-", str((OUT_DIR / "paa-index.json").relative_to(ROOT)))
    print("-", str((OUT_DIR / "top-pages.json").relative_to(ROOT)))
    print("-", str((OUT_DIR / "top-questions.json").relative_to(ROOT)))


if __name__ == "__main__":
    main()

