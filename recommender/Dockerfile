# syntax=docker/dockerfile:1.4

FROM python:3.11.4-slim AS base
WORKDIR /app

COPY --link recommender/requirements.txt ./
COPY --link recommender/serviceAccountKey.json ./

RUN pip uninstall numpy
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --link leetnode/prisma/seed_data.ts ./
COPY --link recommender/model_updated.pkl ./
COPY --link recommender/main.py ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--port", "8000", "--host", "0.0.0.0", "--root-path", "/recommender"]