FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY . /srv
ENV PYTHONPATH=/srv
ENV PORT=8080
CMD ["bash","-lc","python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
