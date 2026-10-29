#!/usr/bin/env python3
"""Consistent SQLite backup, including committed WAL contents; never prints records."""
from pathlib import Path
import sqlite3, sys, os
source = Path(os.environ.get('RIFAN_DB_PATH', '.data/rifan.sqlite'))
if not source.is_file():
    raise SystemExit('Source database does not exist')
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/backup.py /workspace/private-backups/rifan.sqlite')
target = Path(sys.argv[1])
if target.exists():
    raise SystemExit('Refusing to overwrite an existing backup')
target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
with sqlite3.connect(f'file:{source.resolve()}?mode=ro', uri=True) as src:
    with sqlite3.connect(target) as dst:
        src.backup(dst)
os.chmod(target, 0o600)
print('Consistent private database backup created.')
