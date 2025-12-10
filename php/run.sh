#!/bin/bash

# Exit on error
set -e

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

php -S 0.0.0.0:$PORT
