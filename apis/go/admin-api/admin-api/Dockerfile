FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/admin-api ./apis/go/admin-api/admin-api

FROM gcr.io/distroless/static-debian12:nonroot
ENV APP_ENV=production
COPY --from=builder /out/admin-api /admin-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/admin-api"]
