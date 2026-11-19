#!/bin/bash
cd "$(dirname "$0")"
echo "Avvio Codex Hermeticus Scriptorium CMS su http://localhost:8082/admin.html ..."
(sleep 1 && open "http://localhost:8082/admin.html") &
/usr/bin/python3 server.py 8082
