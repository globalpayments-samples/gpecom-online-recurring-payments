#!/bin/bash

# Exit on error
set -e

if ! command -v php >/dev/null 2>&1 || ! php -r '$branch = PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION; $minimums = ["8.2" => "8.2.35", "8.3" => "8.3.36", "8.4" => "8.4.27", "8.5" => "8.5.12"]; exit(isset($minimums[$branch]) && version_compare(PHP_VERSION, $minimums[$branch], ">=") ? 0 : 1);'; then
    printf 'A supported patched PHP release is required (8.2.35+, 8.3.36+, 8.4.27+, or 8.5.12+). Upgrade PHP and try again.\n' >&2
    exit 1
fi

# Install requirements
composer install

# Load environment variables to display merchant ID
if [ -f .env ]; then
    set -a
    source <(cat .env | sed 's/#gitleaks:allow//g' | grep -v '^#')
    set +a
fi

# Start the server
PORT="${PORT:-8000}"
MERCHANT_ID="${MERCHANT_ID:-[not configured]}"
ENVIRONMENT="${ENVIRONMENT:-sandbox}"

echo "============================================================"
echo "Global Payments XML API - Recurring Payments Server"
echo "============================================================"
echo "Server running at: http://localhost:$PORT"
echo "Environment: $ENVIRONMENT"
echo "Merchant ID: $MERCHANT_ID"
echo ""
echo "Available endpoints:"
echo "  GET  /health           - Health check"
echo "  GET  /config           - Get configuration"
echo "  POST /process-payment  - Process payment or setup recurring"
echo ""
echo "Features:"
echo "  ✓ One-time payments"
echo "  ✓ Recurring/subscription payments"
echo "  ✓ Customer and payment method storage"
echo "  ✓ Payment Scheduler integration"
echo "  ✓ StoredCredential for recurring transactions"
echo "  ✓ Multiple frequencies: weekly, bi-weekly, monthly, quarterly, yearly"
echo "============================================================"
echo ""

HOST="${HOST:-127.0.0.1}"
exec php -S "$HOST:$PORT"
