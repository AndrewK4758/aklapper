FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cadence-demo ./apis/go/cadence-demo

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/cadence-demo /cadence-demo
EXPOSE 8082
USER nonroot:nonroot
ENTRYPOINT ["/cadence-demo"]
