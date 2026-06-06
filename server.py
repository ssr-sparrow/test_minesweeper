#!/usr/bin/env python3
"""Run the Minesweeper web app with Python's standard library."""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import socket


HOST = "0.0.0.0"
PORT = 8000


def get_lan_ip():
    """Return the active IPv4 address without sending network traffic."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Computer: http://127.0.0.1:{PORT}")
    lan_ip = get_lan_ip()
    if lan_ip:
        print(f"Phone on the same Wi-Fi: http://{lan_ip}:{PORT}")
    else:
        print("Phone: connect to the computer's LAN IPv4 address on port 8000.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
