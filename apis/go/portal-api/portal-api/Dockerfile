FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/portal-api ./apis/go/portal-api/portal-api

FROM gcr.io/distroless/static-debian12:nonroot
ENV APP_ENV=production
ENV GEOLITE2_DB_DIR=/data/geolite2
COPY --from=builder /out/portal-api /portal-api
COPY --chown=nonroot:nonroot apis/go/portal-api/portal-api/data/geolite2 /data/geolite2
EXPOSE 8084
USER nonroot:nonroot
ENTRYPOINT ["/portal-api"]
