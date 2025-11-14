#!/usr/bin/env python3
"""
Small dev server: serves files from repo root and returns the latest
mooring-data-generator output JSON on GET /hooks.

Run:
    python dev_hooks_server.py 8000

Then open http://localhost:8000/index.html
"""
import http.server
import socketserver
import json
import sys
import os
import glob
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_GLOB = os.path.join(ROOT, 'mooring-data-generator-main', 'output_*.json')

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/hooks':
            # find the newest output file
            files = sorted(glob.glob(OUTPUT_GLOB))
            if not files:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "no output files found"}')
                return
            latest = files[-1]
            try:
                with open(latest, 'rb') as f:
                    data = f.read()
                # if file is already JSON representing the payload, return it
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                payload = {"error": str(e)}
                self.wfile.write(json.dumps(payload).encode('utf-8'))
            return
        # otherwise serve static files
        return super().do_GET()

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except Exception:
            pass
    with socketserver.TCPServer(('0.0.0.0', port), DevHandler) as httpd:
        print(f"Serving at http://0.0.0.0:{port} (root: {ROOT})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down')
            httpd.server_close()
