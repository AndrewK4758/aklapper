FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/k8s-watch ./apis/go/k8s-watch/k8s-watch

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/k8s-watch /k8s-watch
EXPOSE 8081
USER nonroot:nonroot
ENTRYPOINT ["/k8s-watch"]
