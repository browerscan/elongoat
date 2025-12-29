#!/usr/bin/env python3
"""
Prepare Question Batches for Codex Parallel Generation

Reads SEO questions from CSV, filters by volume, and creates batch files
for Claude Code to process with parallel /codex agents.

Input:  data/elon-musk_broad-match_us_question.csv
Output: output/batches/batch_001.json, batch_002.json, ...

Usage:
  python scripts/2_prepare_questions.py                    # Default: 100 questions, batch size 5
  python scripts/2_prepare_questions.py --limit 50         # Only 50 questions
  python scripts/2_prepare_questions.py --batch-size 10    # 10 questions per batch
  python scripts/2_prepare_questions.py --min-volume 5000  # Filter by volume
"""

import json
import argparse
import re
from pathlib import Path
from typing import List, Dict

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas")
    exit(1)


def generate_slug(keyword: str) -> str:
    """Generate URL-friendly slug from keyword"""
    # Convert to lowercase
    slug = keyword.lower()

    # Replace special characters
    slug = re.sub(r"[''`]", "", slug)
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)

    # Replace spaces with hyphens
    slug = re.sub(r"\s+", "-", slug.strip())

    # Remove multiple hyphens
    slug = re.sub(r"-+", "-", slug)

    return slug[:100]  # Limit length


def categorize_question(keyword: str) -> str:
    """Categorize question by topic"""
    keyword_lower = keyword.lower()

    if any(w in keyword_lower for w in ['kid', 'child', 'son', 'daughter', 'baby', 'family']):
        return 'family'
    elif any(w in keyword_lower for w in ['worth', 'money', 'rich', 'wealth', 'billion', 'earn']):
        return 'wealth'
    elif any(w in keyword_lower for w in ['tesla', 'car', 'electric', 'ev', 'cybertruck']):
        return 'tesla'
    elif any(w in keyword_lower for w in ['spacex', 'mars', 'rocket', 'starship', 'space']):
        return 'spacex'
    elif any(w in keyword_lower for w in ['twitter', 'x.com', 'tweet']):
        return 'x-twitter'
    elif any(w in keyword_lower for w in ['old', 'age', 'born', 'birthday', 'young']):
        return 'personal'
    elif any(w in keyword_lower for w in ['wife', 'married', 'girlfriend', 'grimes', 'relationship']):
        return 'relationships'
    elif any(w in keyword_lower for w in ['autis', 'asperger', 'adhd', 'health']):
        return 'health'
    elif any(w in keyword_lower for w in ['citizen', 'american', 'african', 'country', 'live', 'where']):
        return 'citizenship'
    elif any(w in keyword_lower for w in ['buy', 'bought', 'acquire', 'own']):
        return 'acquisitions'
    elif any(w in keyword_lower for w in ['doge', 'crypto', 'bitcoin', 'dogecoin']):
        return 'crypto'
    else:
        return 'general'


def load_questions(csv_path: str, min_volume: int = 0, limit: int = None) -> pd.DataFrame:
    """Load and filter questions from CSV"""
    print(f"\nLoading questions from {csv_path}...")

    df = pd.read_csv(csv_path, encoding='utf-8')
    print(f"  Total rows: {len(df):,}")

    # Ensure required columns
    if 'Keyword' not in df.columns:
        raise ValueError("CSV missing 'Keyword' column")

    # Filter questions only (start with question words)
    question_words = ['how', 'what', 'when', 'where', 'why', 'who', 'is', 'are', 'does', 'did', 'can', 'will', 'has']
    df['is_question'] = df['Keyword'].str.lower().str.split().str[0].isin(question_words)
    df = df[df['is_question']].copy()
    print(f"  Questions only: {len(df):,}")

    # Parse volume
    if 'Volume' in df.columns:
        df['Volume'] = pd.to_numeric(df['Volume'], errors='coerce').fillna(0).astype(int)

        # Filter by volume
        if min_volume > 0:
            df = df[df['Volume'] >= min_volume]
            print(f"  Volume >= {min_volume:,}: {len(df):,}")

        # Sort by volume (descending)
        df = df.sort_values('Volume', ascending=False)

    # Parse difficulty
    if 'Keyword Difficulty' in df.columns:
        df['Difficulty'] = pd.to_numeric(df['Keyword Difficulty'], errors='coerce').fillna(0).astype(int)
    else:
        df['Difficulty'] = 0

    # Apply limit
    if limit and limit < len(df):
        df = df.head(limit)
        print(f"  Limited to: {limit:,}")

    # Add metadata
    df['slug'] = df['Keyword'].apply(generate_slug)
    df['category'] = df['Keyword'].apply(categorize_question)

    return df


def create_batches(df: pd.DataFrame, batch_size: int, output_dir: Path) -> List[str]:
    """Create batch files for Codex processing"""
    print(f"\nCreating batches (size: {batch_size})...")

    batches_dir = output_dir / 'batches'
    batches_dir.mkdir(parents=True, exist_ok=True)

    batch_files = []
    total = len(df)
    batch_num = 0

    for start in range(0, total, batch_size):
        batch_num += 1
        end = min(start + batch_size, total)
        batch_df = df.iloc[start:end]

        # Create batch data
        batch_data = {
            'batch_id': f'batch_{batch_num:03d}',
            'batch_number': batch_num,
            'start_index': start,
            'end_index': end,
            'count': len(batch_df),
            'questions': []
        }

        for idx, row in batch_df.iterrows():
            question = {
                'keyword': row['Keyword'],
                'slug': row['slug'],
                'volume': int(row['Volume']),
                'difficulty': int(row['Difficulty']),
                'category': row['category'],
                'intent': row.get('Intent', 'Informational')
            }
            batch_data['questions'].append(question)

        # Save batch file
        batch_file = batches_dir / f"batch_{batch_num:03d}.json"
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch_data, f, indent=2, ensure_ascii=False)

        batch_files.append(str(batch_file))

    print(f"  Created {batch_num} batch files")
    return batch_files


def create_manifest(df: pd.DataFrame, batch_files: List[str], output_dir: Path):
    """Create manifest file with all metadata"""
    manifest = {
        'total_questions': len(df),
        'total_batches': len(batch_files),
        'volume_range': {
            'min': int(df['Volume'].min()),
            'max': int(df['Volume'].max()),
            'total': int(df['Volume'].sum())
        },
        'categories': df['category'].value_counts().to_dict(),
        'batches': [Path(f).name for f in batch_files]
    }

    manifest_file = output_dir / 'manifest.json'
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest saved to {manifest_file}")

    # Print summary
    print(f"\nCategory Distribution:")
    for cat, count in sorted(manifest['categories'].items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")


def main():
    parser = argparse.ArgumentParser(
        description="Prepare question batches for Codex generation",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--limit',
        type=int,
        default=100,
        help='Maximum number of questions (default: 100)'
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=5,
        help='Questions per batch for parallel processing (default: 5)'
    )

    parser.add_argument(
        '--min-volume',
        type=int,
        default=10000,
        help='Minimum search volume filter (default: 10000)'
    )

    args = parser.parse_args()

    # Paths
    project_root = Path(__file__).parent.parent
    data_dir = project_root / 'data'
    output_dir = project_root / 'output'

    csv_file = data_dir / 'elon-musk_broad-match_us_question.csv'

    print("="*60)
    print("ElonGoat Question Batch Preparer")
    print("="*60)
    print(f"  Limit: {args.limit}")
    print(f"  Batch size: {args.batch_size}")
    print(f"  Min volume: {args.min_volume:,}")

    # Load and filter questions
    df = load_questions(str(csv_file), min_volume=args.min_volume, limit=args.limit)

    if len(df) == 0:
        print("\nNo questions found matching criteria!")
        exit(1)

    # Print top questions
    print(f"\nTop 5 questions by volume:")
    for i, row in df.head(5).iterrows():
        print(f"  {row['Volume']:>6,} | {row['Keyword'][:60]}")

    # Create batches
    batch_files = create_batches(df, args.batch_size, output_dir)

    # Create manifest
    create_manifest(df, batch_files, output_dir)

    print("\n" + "="*60)
    print("Batch preparation complete!")
    print(f"  Total questions: {len(df)}")
    print(f"  Total batches: {len(batch_files)}")
    print(f"  Output: {output_dir / 'batches'}")
    print("="*60)
    print("\nNext step: Use Claude Code to process batches with /codex")
    print("  Example: Process batch_001.json with 5 parallel Codex agents")


if __name__ == '__main__':
    main()
