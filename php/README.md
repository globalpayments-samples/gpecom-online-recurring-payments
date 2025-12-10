# PHP XML API - Recurring Payments Implementation

This PHP application demonstrates recurring payment processing using the **Global Payments XML API** with the Payment Scheduler service.

## Features

- One-time payment processing using Global Payments SDK
- Recurring/subscription payments with XML API
- Customer and payment method storage using Card Storage API
- StoredCredential implementation for recurring transactions
- Multiple billing frequencies: Weekly, Bi-Weekly, Monthly, Quarterly, Yearly
- Initial payment validation before schedule creation

## Requirements

- PHP 7.4 or later
- Composer
- Global Payments XML API credentials:
  - Merchant ID
  - Shared Secret
  - Account name (default: 'internet')

## Project Structure

```
php/
├── XmlApiUtils.php             # XML API utilities
├── PaymentUtils.php            # Payment processing workflow
├── process-payment.php         # One-time payment endpoint
├── recurring-setup.php         # Recurring payment endpoint
├── index.html                  # Frontend payment form
├── script.js                   # Client-side JavaScript
├── composer.json               # Composer dependencies
├── .env.sample                 # Environment variable template
├── run.sh                      # Shell script to run the app
└── README.md                   # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd php
composer install
```

Dependencies:
- GlobalPayments PHP SDK 14.2.20
- vlucas/phpdotenv 5.6
- GuzzleHTTP 7.8

### 2. Configure Environment Variables

Copy `.env.sample` to `.env`:

```bash
cp .env.sample .env
```

Edit `.env` with your credentials:

```env
# XML API Credentials
MERCHANT_ID=your_merchant_id
SHARED_SECRET=your_shared_secret
ACCOUNT=internet

# Environment
ENVIRONMENT=sandbox

# Server Port
PORT=8000
```

### 3. Run the Application

```bash
./run.sh
```

Or manually:

```bash
php -S 0.0.0.0:8000
```

The server will start at `http://localhost:8000`

## API Endpoints

### `POST /process-payment.php`
Process one-time payment (tokenized)

**Request Parameters:**
- `payment_token` (required) - Payment token from client
- `billing_zip` (required) - Billing postal code
- `amount` (required) - Payment amount

### `POST /recurring-setup.php`
Set up recurring payment with direct card details

**Request Body (JSON):**
```json
{
  "card_number": "4263970000005262",
  "card_expiry": "12/25",
  "card_cvv": "123",
  "card_name": "John Doe",
  "amount": 29.99,
  "currency": "USD",
  "frequency": "monthly",
  "start_date": "2024-12-01",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "555-123-4567",
  "billing_zip": "47130",
  "billing_country": "840"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Recurring payment setup completed successfully",
  "data": {
    "customer": {
      "payerRef": "CUS_xxx",
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "payment": {
      "transactionId": "xxx",
      "orderId": "INIT_xxx",
      "authCode": "12345",
      "amount": 29.99,
      "currency": "USD"
    },
    "schedule": {
      "scheduleRef": "SCH_xxx",
      "scheduleText": "Monthly on the 21st",
      "frequency": "monthly",
      "startDate": "2024-12-01",
      "amount": 29.99,
      "currency": "USD"
    }
  }
}
```

## XML API Integration

### 4-Step Workflow

1. **Customer Creation** (`payer-new`)
   - Creates customer in Card Storage API
   - Stores name, email, phone, address

2. **Card Storage** (`card-new`)
   - Creates tokenized card reference
   - Links card to customer

3. **Initial Payment** (`receipt-in`)
   - Processes first payment
   - Marks as recurring (sequence: first)

4. **Schedule Creation** (`schedule-new`)
   - Creates recurring schedule
   - Sets frequency and amount

### Authentication

All XML API requests use SHA-1 hash-based authentication:

1. Concatenate request fields per API specification
2. Generate SHA-1 hash
3. Append shared secret and hash again
4. Include final hash in request

See `XmlApiUtils.php` for implementation details.

## Testing

### Test Cards (Sandbox)

| Card Number | Type | CVV | Expiry |
|-------------|------|-----|--------|
| 4263970000005262 | Visa | 123 | 12/25 |
| 5425230000004415 | Mastercard | 123 | 12/25 |
| 374101000000608 | Amex | 1234 | 12/25 |

### Testing Recurring Payments

1. Navigate to the Recurring Payments tab
2. Fill in customer information
3. Enter test card details
4. Set subscription amount and frequency
5. Click "Set Up Recurring Payment"

Expected result: All 4 XML API calls succeed, schedule is created.

## Security Considerations

Before deploying to production:

- Update `ENVIRONMENT=production` in `.env`
- Use production XML API credentials
- Implement proper client-side tokenization
- Add input validation and sanitization
- Set up HTTPS/TLS
- Review PCI DSS compliance requirements
- Configure proper PHP security directives
- Implement CSRF protection

**Never** store raw card data on your servers.

## Troubleshooting

**Error: "Authentication failed"**
- Verify Merchant ID and Shared Secret
- Check environment (sandbox vs production)

**Error: "Schedule creation failed"**
- Ensure start date is in the future
- Verify customer and card were created successfully

**Composer Errors**
- Ensure PHP 7.4+ is installed
- Run `composer install` to refresh dependencies

## Additional Resources

- [Global Payments Developer Portal](https://developer.globalpay.com)
- [XML API Documentation](https://developer.globalpay.com/ecommerce/api)
- [Payment Scheduler Guide](https://developer.globalpay.com/ecommerce/api/payment-scheduler)

## License

This project is provided as-is for demonstration purposes.
