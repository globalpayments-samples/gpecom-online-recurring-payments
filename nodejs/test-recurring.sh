#!/bin/bash

echo "Testing XML API Recurring Payments"
echo "===================================="
echo ""

# Test 1: Successful monthly payment
echo "Test 1: Successful monthly recurring payment"
curl -s -X POST http://localhost:8000/recurring-setup \
  -H "Content-Type: application/json" \
  -d '{"amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2025-11-25","first_name":"John","last_name":"Smith","email":"john.smith@example.com","phone":"555-123-4567","street_address":"123 Main Street","city":"New York","state":"NY","billing_zip":"10001","country":"840","card_number":"4263970000005262","card_expiry":"12/25","card_cvv":"123"}' \
  | grep -q '"success":true' && echo "✅ PASSED" || echo "❌ FAILED"
echo ""

# Test 2: Missing required field
echo "Test 2: Validation - missing email"
curl -s -X POST http://localhost:8000/recurring-setup \
  -H "Content-Type: application/json" \
  -d '{"amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2025-11-25","first_name":"John","last_name":"Smith","street_address":"123 Main Street","city":"New York","state":"NY","billing_zip":"10001","country":"840","card_number":"4263970000005262","card_expiry":"12/25","card_cvv":"123"}' \
  | grep -q '"error_code":"MISSING_CUSTOMER_INFO"' && echo "✅ PASSED" || echo "❌ FAILED"
echo ""

# Test 3: Invalid card expiry format
echo "Test 3: Validation - invalid expiry format"
curl -s -X POST http://localhost:8000/recurring-setup \
  -H "Content-Type: application/json" \
  -d '{"amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2025-11-25","first_name":"John","last_name":"Smith","email":"john.smith@example.com","phone":"555-123-4567","street_address":"123 Main Street","city":"New York","state":"NY","billing_zip":"10001","country":"840","card_number":"4263970000005262","card_expiry":"1225","card_cvv":"123"}' \
  | grep -q '"error_code":"INVALID_EXPIRY"' && echo "✅ PASSED" || echo "❌ FAILED"
echo ""

# Test 4: Different country (Canada)
echo "Test 4: Canadian customer with country code 124"
curl -s -X POST http://localhost:8000/recurring-setup \
  -H "Content-Type: application/json" \
  -d '{"amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2025-11-25","first_name":"Emma","last_name":"Johnson","email":"emma.johnson@example.ca","phone":"416-555-0123","street_address":"789 Maple Avenue","city":"Toronto","state":"ON","billing_zip":"M5H2N2","country":"124","card_number":"4263970000005262","card_expiry":"12/25","card_cvv":"123"}' \
  | grep -q '"success":true' && echo "✅ PASSED" || echo "❌ FAILED"
echo ""

echo "===================================="
echo "Tests completed!"
