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
        # print(f"Received {len(records)} hook records at {datetime.now().isoformat()}")
        # print("Records:", json.dumps(records, indent=2))
        # for record in records:
        #    print(
        #        f"  - {record['port_name']} / {record['berth_name']} / {record['bollard_name']} / {record['hook_name']}: {record['tension']} tension"
        #    )
        for record in records:
            monitor.update_from_record(record)

        # Print hooks that need attention
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


if __name__ == "__main__":
    server_address = ("127.0.0.1", 8000)
    httpd = HTTPServer(server_address, MooringHandler)
    print("Listening on http://127.0.0.1:8000/")
    httpd.serve_forever()
