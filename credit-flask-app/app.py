"""SWE40006 Task 4: a basic Flask web app that reports which host it is running on.

The page shows the container hostname, so the same image can be shown running
on two different Docker hosts (the Windows PC and the EC2 instance).
"""
import os
import platform
import socket
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template

APP_VERSION = "1.0"

app = Flask(__name__)


def runtime_info():
    return {
        "app_version": APP_VERSION,
        "container_hostname": socket.gethostname(),
        "python_version": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}",
        "architecture": platform.machine(),
        "host_label": os.environ.get("HOST_LABEL", "not set"),
        "server_time_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


@app.route("/")
def index():
    return render_template("index.html", info=runtime_info())


@app.route("/health")
def health():
    return jsonify(status="Healthy", **runtime_info())


if __name__ == "__main__":
    # Only used when running without Docker. Inside the container Gunicorn starts the app.
    app.run(host="0.0.0.0", port=5000)
