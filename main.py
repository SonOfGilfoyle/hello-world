"""Kleiner Static-Server fuer PFANDLORD."""
import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", 8000))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"PFANDLORD laeuft auf http://localhost:{PORT}")
        httpd.serve_forever()
