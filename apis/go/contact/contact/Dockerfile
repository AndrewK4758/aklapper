FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY go.work ./
COPY packages/go ./packages/go
COPY apis/go ./apis/go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/contact ./apis/go/contact/contact

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/contact /contact
EXPOSE 8084
USER nonroot:nonroot
ENTRYPOINT ["/contact"]
