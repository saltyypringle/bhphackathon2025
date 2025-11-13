from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from parsejson import parse_mooring_payload
from datetime import datetime
from hookclass import MooringMonitor, Hook

monitor = MooringMonitor()


class MooringHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Invalid JSON")
            return

        records = parse_mooring_payload(payload)
        for record in records:
            monitor.update_from_record(record)

        attention_hooks = monitor.hooks_needing_attention()
        if attention_hooks:
            print(f"\n*** Hooks needing attention at {datetime.now().isoformat()} ***")
            for hook in attention_hooks:
                status = "CRITICAL" if hook.is_critical() else "ATTENTION"
                print(f"{status}: {hook}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps({"status": "success", "records_received": len(records)}).encode(
                "utf-8"
            )
        )

    def do_GET(self):
        """
        GET /hooks
        Returns JSON list of current hooks and their state.
        """
        if self.path != "/hooks":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        # Build serializable list of hooks
        hooks_list = []
        for key, hook in monitor.hooks.items():
            hooks_list.append(
                {
                    "key": key,
                    "hook_name": hook.name,
                    "bollard_name": hook.bollard_name,
                    "berth_name": hook.berth_name,
                    "port_name": hook.port_name,
                    "tension": hook.current_tension,
                    "max_tension": hook.max_tension,
                    "percent": None if hook.tension_percent() is None else round(hook.tension_percent(), 1),
                    "rate": hook.rate_of_change(),
                    "faulted": hook.faulted,
                    "attached_line": hook.attached_line,
                    "history": hook.history,
                }
            )

        body = json.dumps({"hooks": hooks_list}).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        # Allow local web pages to fetch this
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server_address = ("127.0.0.1", 8000)
    httpd = HTTPServer(server_address, MooringHandler)
    print("Listening on http://127.0.0.1:8000/")
    httpd.serve_forever()
