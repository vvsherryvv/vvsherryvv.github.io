#!/usr/bin/env bash
set -euo pipefail

mode="${1:---source}"
case "$mode" in
  --source|--candidate) ;;
  *)
    echo "usage: bash Scripts/verify_site.sh --source|--candidate" >&2
    exit 2
    ;;
esac

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
python3 Scripts/site_audit.py "$mode"
