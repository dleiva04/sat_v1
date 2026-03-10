#!/bin/bash
set -e

pip install -r requirements.txt

cd frontend && npm install && npm run build && cd ..

uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
