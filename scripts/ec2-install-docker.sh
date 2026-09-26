#!/bin/bash
# Installs Docker Engine on Amazon Linux 2023 and lets ec2-user run docker without sudo.
# After running this, close the terminal and reconnect so the group change takes effect.
set -e
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
docker --version
echo "Docker installed. Disconnect and reconnect, then run: docker run hello-world"
