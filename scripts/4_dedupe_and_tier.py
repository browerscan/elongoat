#!/usr/bin/env python3
"""
Deduplicate Questions and Create Content Tiers

This script:
1. Analyzes all questions for semantic duplicates
2. Assigns tiers based on search volume
3. Creates a canonical mapping for similar questions
4. Generates optimized batch files

Output:
- output/content_plan.json
- output/batches_v2/
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Tuple
from collections import defaultdict

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed")
    exit(1)


def normalize_question(q: str) -> str:
    """Normalize question for comparison"""
    q = q.lower().strip()
    # Remove common variations
    q = re.sub(r'\belon musk\'?s?\b', 'elon', q)
    q = re.sub(r'\bkids?\b', 'children', q)
    q = re.sub(r'\bchild\b', 'children', q)
    q = re.sub(r'\bwife\b', 'married', q)
    q = re.sub(r'\bwives\b', 'married', q)
    q = re.sub(r'\brich\b', 'wealth', q)
    q = re.sub(r'\bworth\b', 'wealth', q)
    q = re.sub(r'\bmoney\b', 'wealth', q)
    q = re.sub(r'\bu\.?s\.?\b', 'american', q)
    q = re.sub(r'\busa\b', 'american', q)
    q = re.sub(r'\bunited states\b', 'american', q)
    q = re.sub(r'\bcitizen\b', 'citizenship', q)
    q = re.sub(r'\bborn\b', 'from', q)
    q = re.sub(r'\bautistic\b', 'autism', q)
    q = re.sub(r'\baspergers?\b', 'autism', q)
    q = re.sub(r'\bspectrum\b', 'autism', q)
    # Remove punctuation
    q = re.sub(r'[^\w\s]', '', q)
    # Remove extra spaces
    q = re.sub(r'\s+', ' ', q).strip()
    return q


def extract_core_topic(q: str) -> str:
    """Extract core topic from question"""
    normalized = normalize_question(q)

    # Topic patterns
    patterns = [
        (r'children|family|baby', 'children'),
        (r'wealth|net worth|billion|earn|make', 'wealth'),
        (r'age|old|born|birthday', 'age'),
        (r'citizenship|american|immigrant|from|country|live', 'origin'),
        (r'married|relationship|girlfriend|wife', 'relationships'),
        (r'autism|asperger|health|diagnos', 'health'),
        (r'tesla|car|electric|cybertruck', 'tesla'),
        (r'spacex|mars|rocket|space', 'spacex'),
        (r'twitter|x\.com', 'x-twitter'),
        (r'doge|crypto|bitcoin|dogecoin', 'crypto'),
        (r'buy|bought|acquire|own', 'acquisitions'),
        (r'president|run|election|politic', 'politics'),
    ]

    for pattern, topic in patterns:
        if re.search(pattern, normalized):
            return topic

    return 'general'


def find_duplicates(questions: List[Dict]) -> Dict[str, List[Dict]]:
    """Group similar questions together"""
    groups = defaultdict(list)

    for q in questions:
        normalized = normalize_question(q['keyword'])
        # Create a signature based on key words
        words = set(normalized.split())

        # Check existing groups
        merged = False
        for sig, group in list(groups.items()):
            sig_words = set(sig.split())
            # If 70%+ overlap, merge
            overlap = len(words & sig_words) / max(len(words), len(sig_words))
            if overlap > 0.7:
                groups[sig].append(q)
                merged = True
                break

        if not merged:
            groups[normalized].append(q)

    return dict(groups)


def assign_tier(volume: int) -> Tuple[int, str]:
    """Assign content tier based on volume"""
    if volume >= 30000:
        return 1, "premium"  # 1500+ words, manual review
    elif volume >= 10000:
        return 2, "standard"  # 1300+ words
    else:
        return 3, "longtail"  # 1000+ words


def select_canonical(group: List[Dict]) -> Dict:
    """Select the best question as canonical from a group"""
    # Sort by volume (highest first), then by keyword length (shorter preferred)
    sorted_group = sorted(group, key=lambda x: (-x['volume'], len(x['keyword'])))
    canonical = sorted_group[0]

    # Add alternates
    canonical['alternates'] = [q['keyword'] for q in sorted_group[1:]]
    canonical['alternate_slugs'] = [q['slug'] for q in sorted_group[1:]]

    return canonical


def main():
    project_root = Path(__file__).parent.parent
    data_dir = project_root / 'data'
    output_dir = project_root / 'output'

    print("="*60)
    print("ElonGoat Content Deduplication & Tier Assignment")
    print("="*60)

    # Load questions from CSV
    csv_path = data_dir / 'elon-musk_broad-match_us_question.csv'
    df = pd.read_csv(csv_path, encoding='utf-8')

    # Filter to questions with volume >= 1000
    df['Volume'] = pd.to_numeric(df['Volume'], errors='coerce').fillna(0).astype(int)
    df = df[df['Volume'] >= 1000]

    # Filter to actual questions
    question_words = ['how', 'what', 'when', 'where', 'why', 'who', 'is', 'are', 'does', 'did', 'can', 'will', 'has']
    df['is_question'] = df['Keyword'].str.lower().str.split().str[0].isin(question_words)
    df = df[df['is_question']]

    # Sort by volume
    df = df.sort_values('Volume', ascending=False)

    # Take top 150 for analysis
    df = df.head(150)

    print(f"\nAnalyzing {len(df)} questions...")

    # Convert to list of dicts
    questions = []
    for _, row in df.iterrows():
        slug = re.sub(r'[^a-z0-9\s-]', '', row['Keyword'].lower())
        slug = re.sub(r'\s+', '-', slug.strip())[:100]

        questions.append({
            'keyword': row['Keyword'],
            'slug': slug,
            'volume': int(row['Volume']),
            'difficulty': int(row.get('Keyword Difficulty', 0)) if pd.notna(row.get('Keyword Difficulty')) else 0,
            'topic': extract_core_topic(row['Keyword'])
        })

    # Find duplicates
    print("\nFinding duplicate groups...")
    groups = find_duplicates(questions)

    # Stats
    total_groups = len(groups)
    duplicates_found = sum(1 for g in groups.values() if len(g) > 1)

    print(f"  Total unique topics: {total_groups}")
    print(f"  Groups with duplicates: {duplicates_found}")

    # Select canonicals and assign tiers
    print("\nAssigning tiers...")
    content_plan = {
        'tier_1_premium': [],
        'tier_2_standard': [],
        'tier_3_longtail': [],
        'duplicate_map': {},
        'stats': {}
    }

    for sig, group in groups.items():
        canonical = select_canonical(group)
        tier_num, tier_name = assign_tier(canonical['volume'])

        entry = {
            'keyword': canonical['keyword'],
            'slug': canonical['slug'],
            'volume': canonical['volume'],
            'difficulty': canonical['difficulty'],
            'topic': canonical['topic'],
            'tier': tier_num,
            'alternates': canonical.get('alternates', []),
            'alternate_slugs': canonical.get('alternate_slugs', [])
        }

        if tier_num == 1:
            content_plan['tier_1_premium'].append(entry)
        elif tier_num == 2:
            content_plan['tier_2_standard'].append(entry)
        else:
            content_plan['tier_3_longtail'].append(entry)

        # Build redirect map
        for alt_slug in canonical.get('alternate_slugs', []):
            content_plan['duplicate_map'][alt_slug] = canonical['slug']

    # Sort each tier by volume
    for tier in ['tier_1_premium', 'tier_2_standard', 'tier_3_longtail']:
        content_plan[tier].sort(key=lambda x: -x['volume'])

    # Stats
    content_plan['stats'] = {
        'total_unique': total_groups,
        'tier_1_count': len(content_plan['tier_1_premium']),
        'tier_2_count': len(content_plan['tier_2_standard']),
        'tier_3_count': len(content_plan['tier_3_longtail']),
        'duplicates_merged': sum(len(e.get('alternates', [])) for t in [content_plan['tier_1_premium'], content_plan['tier_2_standard'], content_plan['tier_3_longtail']] for e in t),
        'tier_1_volume': sum(e['volume'] for e in content_plan['tier_1_premium']),
        'tier_2_volume': sum(e['volume'] for e in content_plan['tier_2_standard']),
        'tier_3_volume': sum(e['volume'] for e in content_plan['tier_3_longtail'])
    }

    # Print summary
    print(f"\n{'='*60}")
    print("CONTENT PLAN SUMMARY")
    print(f"{'='*60}")
    print(f"\nTier 1 (Premium, 30K+ volume): {content_plan['stats']['tier_1_count']} questions")
    print(f"  Total volume: {content_plan['stats']['tier_1_volume']:,}")
    for q in content_plan['tier_1_premium'][:5]:
        print(f"    {q['volume']:>7,} | {q['keyword'][:50]}")

    print(f"\nTier 2 (Standard, 10K-30K volume): {content_plan['stats']['tier_2_count']} questions")
    print(f"  Total volume: {content_plan['stats']['tier_2_volume']:,}")

    print(f"\nTier 3 (Longtail, 1K-10K volume): {content_plan['stats']['tier_3_count']} questions")
    print(f"  Total volume: {content_plan['stats']['tier_3_volume']:,}")

    print(f"\nDuplicates merged: {content_plan['stats']['duplicates_merged']}")

    # Save content plan
    plan_path = output_dir / 'content_plan.json'
    with open(plan_path, 'w', encoding='utf-8') as f:
        json.dump(content_plan, f, indent=2, ensure_ascii=False)
    print(f"\nContent plan saved to: {plan_path}")

    # Generate new batch files
    print(f"\n{'='*60}")
    print("GENERATING OPTIMIZED BATCHES")
    print(f"{'='*60}")

    batches_dir = output_dir / 'batches_v2'
    batches_dir.mkdir(exist_ok=True)

    # Combine all questions, sorted by tier then volume
    all_questions = (
        content_plan['tier_1_premium'] +
        content_plan['tier_2_standard'] +
        content_plan['tier_3_longtail']
    )

    batch_size = 5
    batch_num = 0
    batch_files = []

    for i in range(0, len(all_questions), batch_size):
        batch_num += 1
        batch_questions = all_questions[i:i+batch_size]

        # Determine batch tier (highest tier in batch)
        batch_tier = min(q['tier'] for q in batch_questions)

        batch_data = {
            'batch_id': f'batch_{batch_num:03d}',
            'batch_number': batch_num,
            'tier': batch_tier,
            'word_requirement': 1500 if batch_tier == 1 else (1300 if batch_tier == 2 else 1000),
            'count': len(batch_questions),
            'total_volume': sum(q['volume'] for q in batch_questions),
            'questions': batch_questions
        }

        batch_file = batches_dir / f'batch_{batch_num:03d}.json'
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch_data, f, indent=2, ensure_ascii=False)

        batch_files.append(batch_file.name)

    print(f"Generated {batch_num} batch files in {batches_dir}")

    # Update manifest
    manifest = {
        'total_unique_questions': len(all_questions),
        'total_batches': batch_num,
        'tiers': {
            'tier_1': {'count': content_plan['stats']['tier_1_count'], 'word_req': 1500},
            'tier_2': {'count': content_plan['stats']['tier_2_count'], 'word_req': 1300},
            'tier_3': {'count': content_plan['stats']['tier_3_count'], 'word_req': 1000}
        },
        'total_volume': content_plan['stats']['tier_1_volume'] + content_plan['stats']['tier_2_volume'] + content_plan['stats']['tier_3_volume'],
        'duplicates_merged': content_plan['stats']['duplicates_merged'],
        'batches': batch_files
    }

    manifest_path = output_dir / 'manifest_v2.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest saved to: {manifest_path}")

    print(f"\n{'='*60}")
    print("DONE!")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
