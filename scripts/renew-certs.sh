#!/usr/bin/env sh
# Renew the TLS cert for local.printr.dev and copy the updated files into certs/.
#
# Usage:
#   bun run certs:renew
#
# Requires CF_DNS_TOKEN in .env (Cloudflare API token with Zone:DNS:Edit on printr.dev).
# acme.sh must be installed: curl https://get.acme.sh | sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env if present
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  . "$REPO_ROOT/.env"
  set +a
fi

if [ -z "$CF_DNS_TOKEN" ]; then
  echo "error: CF_DNS_TOKEN is not set" >&2
  exit 1
fi

echo "Renewing cert for local.printr.dev…"
CF_Token="$CF_DNS_TOKEN" ~/.acme.sh/acme.sh --renew -d local.printr.dev --dns dns_cf

echo "Copying renewed cert files into certs/…"
cp ~/.acme.sh/local.printr.dev_ecc/fullchain.cer "$REPO_ROOT/certs/fullchain.pem"
cp ~/.acme.sh/local.printr.dev_ecc/local.printr.dev.key "$REPO_ROOT/certs/key.pem"

echo "Done. Commit certs/ to publish the renewed cert."
