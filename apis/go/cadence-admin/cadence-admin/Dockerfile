FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cadence-admin ./apis/go/cadence-admin/cadence-admin

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/cadence-admin /cadence-admin
EXPOSE 8085
USER nonroot:nonroot
ENTRYPOINT ["/cadence-admin"]
