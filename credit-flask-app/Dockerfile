# Task 4.2 Credit: Flask app packaged with its Python runtime and dependencies.

# Slim variant of the official Python image. Smaller than the full image but still Debian based.
FROM python:3.13-slim

# Do not write .pyc files and do not buffer stdout, so logs appear in "docker logs" straight away.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy the dependency list on its own first. This layer and the pip install below are cached
# and only rebuilt when requirements.txt changes, not every time app.py changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the application code.
COPY app.py .
COPY templates/ templates/

# Documents the port the app listens on inside the container. Publishing it is done with -p.
EXPOSE 5000

# Gunicorn is a production web server. It binds to 0.0.0.0 so traffic arriving from outside
# the container is accepted. Binding to 127.0.0.1 would only accept traffic from inside it.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--access-logfile", "-", "app:app"]
