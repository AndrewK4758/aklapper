#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-aklapper-ci/portal-api:check}"
MAX_RSS_MIB="${MAX_RSS_MIB:-400}"
CONCURRENT_REQS="${CONCURRENT_REQS:-20}"
CONTAINER_NAME="portal-api-rss-check-$$-$(date +%s)"
TMP_DIR="$(mktemp -d)"
AUTH_SECRET="portal-api-rss-verification-hmac-secret-0123456789"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

MMDB_DIR="$TMP_DIR/geolite2"
mkdir -p "$MMDB_DIR"

# Generate valid MaxMind DB v2 GeoLite2-City (~64 MiB) and GeoLite2-ASN (~8 MiB) fixtures
# matching production mmap footprints, plus gRPC payload and HMAC-signed internal headers.
python3 - "$MMDB_DIR" "$TMP_DIR" "$AUTH_SECRET" <<'PY'
import base64
import hashlib
import hmac
import json
import os
import struct
import sys
import time

mmdb_dir, tmp_dir, secret = sys.argv[1], sys.argv[2], sys.argv[3]

def encode_size(type_num: int, size: int) -> bytes:
    if size < 29:
        return bytes([(type_num << 5) | size])
    return bytes([(type_num << 5) | 29, size - 29])

def encode_utf8(val: str) -> bytes:
    raw = val.encode("utf-8")
    return encode_size(2, len(raw)) + raw

def encode_uint(type_num: int, val: int) -> bytes:
    raw = bytearray()
    v = val
    while v > 0:
        raw.insert(0, v & 0xFF)
        v >>= 8
    if type_num >= 8:
        return bytes([len(raw), type_num - 7]) + bytes(raw)
    return bytes([(type_num << 5) | len(raw)]) + bytes(raw)

def encode_map(entries: list[tuple[str, bytes]]) -> bytes:
    out = bytearray(encode_size(7, len(entries)))
    for k, v in entries:
        out.extend(encode_utf8(k))
        out.extend(v)
    return bytes(out)

def encode_array(items: list[bytes]) -> bytes:
    out = bytearray([len(items), 11 - 7])
    for item in items:
        out.extend(item)
    return bytes(out)

def build_mmdb(db_type: str, payload_map: bytes, pad_bytes: int) -> bytes:
    search_tree = bytes([0x00, 0x00, 0x11, 0x00, 0x00, 0x11])
    separator = bytes(16)
    marker = bytes([0xAB, 0xCD, 0xEF]) + b"MaxMind.com"
    metadata = encode_map([
        ("binary_format_major_version", encode_uint(5, 2)),
        ("binary_format_minor_version", encode_uint(5, 0)),
        ("build_epoch", encode_uint(9, 1700000000)),
        ("database_type", encode_utf8(db_type)),
        ("ip_version", encode_uint(5, 4)),
        ("node_count", encode_uint(6, 1)),
        ("record_size", encode_uint(5, 24)),
    ])
    return search_tree + separator + payload_map + bytes(pad_bytes) + marker + metadata

city_rec = encode_map([
    ("country", encode_map([("iso_code", encode_utf8("US"))])),
    ("subdivisions", encode_array([
        encode_map([
            ("iso_code", encode_utf8("GA")),
            ("names", encode_map([("en", encode_utf8("Georgia"))])),
        ])
    ])),
    ("city", encode_map([("names", encode_map([("en", encode_utf8("Atlanta"))]))])),
    ("location", encode_map([("time_zone", encode_utf8("America/New_York"))])),
])
asn_rec = encode_map([
    ("autonomous_system_number", encode_uint(6, 64512)),
    ("autonomous_system_organization", encode_utf8("Acme Recruiting Fiber")),
])

with open(os.path.join(mmdb_dir, "GeoLite2-City.mmdb"), "wb") as f:
    f.write(build_mmdb("GeoLite2-City", city_rec, 64 * 1024 * 1024))
with open(os.path.join(mmdb_dir, "GeoLite2-ASN.mmdb"), "wb") as f:
    f.write(build_mmdb("GeoLite2-ASN", asn_rec, 8 * 1024 * 1024))

def sign_token(role: str, sub: str) -> str:
    now = int(time.time())
    payload = json.dumps(
        {"role": role, "sub": sub, "iat": now, "exp": now + 300},
        separators=(",", ":"),
    ).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    signing_input = f"v1.{payload_b64}"
    sig = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{signing_input}.{sig_b64}"

with open(os.path.join(tmp_dir, "auth.token"), "w", encoding="utf-8") as f:
    f.write(sign_token("service", "rss-verify-probe"))
with open(os.path.join(tmp_dir, "client-ip.token"), "w", encoding="utf-8") as f:
    f.write(sign_token("service", "client-ip:198.51.100.42"))

# Protobuf RecordSsrHitRequest { pathname = "/rss-probe" } wrapped in 5-byte gRPC frame
pb = b"\x0a\x0a/rss-probe"
frame = struct.pack(">BI", 0, len(pb)) + pb
with open(os.path.join(tmp_dir, "ssr-hit.grpc"), "wb") as f:
    f.write(frame)
PY

chmod a+rx "$TMP_DIR" "$MMDB_DIR"
chmod a+r "$MMDB_DIR"/*.mmdb

docker run -d \
  --name "$CONTAINER_NAME" \
  --memory=512m \
  --memory-swap=512m \
  -p "127.0.0.1:0:8084" \
  -v "$MMDB_DIR:/data/geolite2:ro" \
  -e APP_ENV=development \
  -e PG_DISABLE_LIVE=true \
  -e INTERNAL_AUTH_SECRET="$AUTH_SECRET" \
  -e ANALYTICS_DAILY_SALT="rss-verify-daily-salt" \
  -e GEOLITE2_DB_DIR=/data/geolite2 \
  "$IMAGE_TAG" >/dev/null

PORT_MAPPING="$(docker port "$CONTAINER_NAME" 8084/tcp | head -n1)"
HOST_PORT="${PORT_MAPPING##*:}"
if [ -z "$HOST_PORT" ]; then
  echo "Failed to resolve host port for $CONTAINER_NAME" >&2
  docker logs "$CONTAINER_NAME" >&2 || true
  exit 1
fi

HEALTH_OK=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/health" | grep -q '"service":"portal-api"'; then
    HEALTH_OK=1
    break
  fi
  sleep 0.25
done
if [ "$HEALTH_OK" -ne 1 ]; then
  echo "portal-api /health check failed to become ready" >&2
  docker logs "$CONTAINER_NAME" >&2 || true
  exit 1
fi

AUTH_TOKEN="$(cat "$TMP_DIR/auth.token")"
IP_TOKEN="$(cat "$TMP_DIR/client-ip.token")"

PIDS=()
for i in $(seq 1 "$CONCURRENT_REQS"); do
  (
    hdr_file="$TMP_DIR/resp-${i}.hdr"
    http_code="$(curl -sS --http2-prior-knowledge \
      -o /dev/null \
      -D "$hdr_file" \
      -w '%{http_code}' \
      -X POST \
      -H 'Content-Type: application/grpc' \
      -H 'TE: trailers' \
      -H "x-internal-auth: ${AUTH_TOKEN}" \
      -H "x-internal-client-ip: ${IP_TOKEN}" \
      --data-binary "@$TMP_DIR/ssr-hit.grpc" \
      "http://127.0.0.1:${HOST_PORT}/portal.v1.AnalyticsService/RecordSsrHit")"
    if [ "$http_code" != "200" ]; then
      echo "Concurrent GeoIP gRPC probe #${i} failed with HTTP ${http_code}" >&2
      cat "$hdr_file" >&2 || true
      exit 1
    fi
    if ! grep -iq '^grpc-status:[[:space:]]*0' "$hdr_file"; then
      echo "Concurrent GeoIP gRPC probe #${i} missing grpc-status: 0" >&2
      cat "$hdr_file" >&2 || true
      exit 1
    fi
  ) &
  PIDS+=("$!")
done

for pid in "${PIDS[@]}"; do
  wait "$pid"
done

CONTAINER_LOGS="$(docker logs "$CONTAINER_NAME" 2>&1 || true)"
if ! echo "$CONTAINER_LOGS" | grep -q '"event":"analytics.geoip.lookup_branch"' || \
   ! echo "$CONTAINER_LOGS" | grep -q '"branch":"mmdb_hit"'; then
  echo "Expected GeoLite2 mmdb_hit seam log in portal-api container logs" >&2
  echo "$CONTAINER_LOGS" >&2
  exit 1
fi

OOM_KILLED="$(docker inspect -f '{{.State.OOMKilled}}' "$CONTAINER_NAME")"
CONTAINER_ID="$(docker inspect -f '{{.Id}}' "$CONTAINER_NAME")"
STATS_MEM="$(docker stats --no-stream --format '{{.MemUsage}}' "$CONTAINER_NAME" | awk '{print $1}')"

CGROUP_PEAK_BYTES=""
for candidate in \
  "/sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope/memory.peak" \
  "/sys/fs/cgroup/docker/${CONTAINER_ID}/memory.peak"; do
  if [ -r "$candidate" ]; then
    CGROUP_PEAK_BYTES="$(cat "$candidate" 2>/dev/null || true)"
    break
  fi
done

python3 - "$OOM_KILLED" "$STATS_MEM" "$CGROUP_PEAK_BYTES" "$MAX_RSS_MIB" <<'PY'
import re
import sys

oom_killed, stats_mem, peak_raw, max_mib_raw = sys.argv[1:5]
max_mib = float(max_mib_raw)

if oom_killed.strip().lower() != "false":
    print(f"FAIL: portal-api container reported OOMKilled={oom_killed}", file=sys.stderr)
    sys.exit(1)

def parse_docker_mem_mib(raw: str) -> float:
    m = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)\s*$", raw)
    if not m:
        raise ValueError(f"Unparseable docker stats MemUsage: {raw!r}")
    val = float(m.group(1))
    unit = m.group(2)
    factors = {
        "B": 1.0 / (1024 * 1024),
        "KiB": 1.0 / 1024,
        "kB": 1000.0 / (1024 * 1024),
        "MiB": 1.0,
        "MB": 1000.0 * 1000.0 / (1024 * 1024),
        "GiB": 1024.0,
        "GB": 1000.0 * 1000.0 * 1000.0 / (1024 * 1024),
    }
    if unit not in factors:
        raise ValueError(f"Unknown memory unit {unit!r} in {raw!r}")
    return val * factors[unit]

stats_mib = parse_docker_mem_mib(stats_mem)
peak_mib = (int(peak_raw) / (1024 * 1024)) if peak_raw.strip().isdigit() else None
effective_mib = max(stats_mib, peak_mib) if peak_mib is not None else stats_mib

print(
    f"portal-api 512Mi RSS check: OOMKilled={oom_killed} "
    f"docker_stats={stats_mib:.2f}MiB "
    f"cgroup_memory_peak={(f'{peak_mib:.2f}MiB' if peak_mib is not None else 'unavailable')} "
    f"ceiling={max_mib:.0f}MiB"
)

if effective_mib >= max_mib:
    print(
        f"FAIL: portal-api memory {effective_mib:.2f} MiB reached/exceeded {max_mib:.0f} MiB ceiling",
        file=sys.stderr,
    )
    sys.exit(1)
PY
