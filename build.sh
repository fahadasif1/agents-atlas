#!/bin/sh
# Rebuild classified CSV, SQLite working copy, UK map data, then encrypt site data with the key in ../atlas_key.txt
cd "$(dirname "$0")" && python3 -I build/classify.py && python3 -I build/uk_export.py && python3 build/encrypt.py
