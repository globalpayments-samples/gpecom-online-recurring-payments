# Global Payments XML API - Recurring Payments Implementation

This Node.js application demonstrates recurring payment processing using the **Global Payments XML API** with the Payment Scheduler service. It has been migrated from the GP-API (REST) reference implementation to use XML API throughout.

## Features

✅ **One-time payment processing** using XML API
✅ **Recurring/subscription payments** with Payment Scheduler
✅ **Client-side card tokenization** (simplified for demo)
✅ **Customer and payment method storage** using Card Storage API
✅ **StoredCredential implementation** for recurring transactions
✅ **Multiple billing frequencies**: Weekly, Bi-Weekly, Monthly, Quarterly, Yearly
✅ **Initial payment validation** before schedule creation
✅ **Complete customer data collection** (name, email, phone, address)

## Architecture Overview

This implementation follows the XML API workflow:

1. **Frontend Initialization**: Load payment form and collect customer/card data
2. **Card Tokenization**: Create token from card data (simplified in this demo)
3. **Backend Processing**:
   - Create customer (payer) in Card Storage API
   - Create card reference and store payment method
   - Process initial payment with StoredCredential (first transaction)
   - Create recurring schedule in Payment Scheduler
4. **Future Charges**: Automated billing per schedule using stored payment method

## Requirements

- **Node.js** 14.x or later
- **npm** (Node Package Manager)
- **Global Payments XML API credentials**:
  - Merchant ID
  - Shared Secret
  - Account name (default: 'internet')

## Project Structure

```
nodejs/
├── server.js              # Main Express server with API endpoints
├── paymentUtils.js        # Payment processing and XML API integration
├── xmlApiUtils.js         # XML API utilities (auth, hashing, XML builders)
├── index.html             # Frontend payment forms
├── script.js              # Client-side JavaScript
├── package.json           # Dependencies
├── .env.sample            # Environment variable template
├── .env                   # Your credentials (create from .env.sample)
└── README.md              # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd nodejs
npm install
```

Dependencies installed:
- `express` - Web server framework
- `dotenv` - Environment variable management
- `xml2js` - XML parsing and building
- `axios` - HTTP client for XML API requests

### 2. Configure Environment Variables

Copy `.env.sample` to `.env`:

```bash
cp .env.sample .env
```

Edit `.env` with your XML API credentials:

```env
# XML API Credentials
MERCHANT_ID=your_merchant_id_here
SHARED_SECRET=your_shared_secret_here
ACCOUNT=internet

# Environment
XML_API_ENVIRONMENT=sandbox

# Server Port
PORT=8000
```

**Where to get credentials:**
- Merchant ID and Shared Secret are provided when you sign up for Global Payments XML API
- For sandbox testing, use your test credentials
- For production, update `XML_API_ENVIRONMENT=production`

### 3. Run the Application

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start at `http://localhost:8000`

### 4. Access the Application

Open your browser to:
```
http://localhost:8000
```

You'll see four tabs:
1. **Payment Form** - One-time payments
2. **Tokenization** - Token generation demo
3. **Webhooks** - Webhook information
4. **Recurring Payments** - Recurring payment setup

## API Endpoints

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "environment": "sandbox",
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

### `GET /config`
Returns configuration for client-side initialization

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "your_merchant_id",
    "environment": "sandbox"
  },
  "message": "Configuration retrieved successfully",
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

**Note:** The shared secret is NEVER sent to the client.

### `POST /process-payment`
Process one-time or recurring payment

**Request Body (One-Time Payment):**
```json
{
  "payment_token": "TOKEN_xxx",
  "amount": 29.99,
  "currency": "USD",
  "billing_zip": "47130",
  "is_recurring": false
}
```

**Request Body (Recurring Payment):**
```json
{
  "payment_token": "TOKEN_xxx",
  "amount": 29.99,
  "currency": "USD",
  "is_recurring": true,
  "frequency": "monthly",
  "start_date": "2025-11-05",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "555-123-4567",
  "street_address": "1 Example Way",
  "city": "Jeffersonville",
  "state": "IN",
  "billing_zip": "47130",
  "country": "US"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Recurring payment setup completed successfully",
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
      "scheduleText": "Monthly recurring payment",
      "frequency": "monthly",
      "startDate": "2025-11-05",
      "amount": 29.99,
      "currency": "USD"
    }
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

## XML API Integration Details

### Authentication

All XML API requests use **SHA-1 hash-based authentication**:

1. Concatenate request fields per the API specification
2. Generate SHA-1 hash of the concatenated string
3. Append shared secret and hash again
4. Include final hash in `<sha1hash>` element

**Example (Payment Hash):**
```
Blueprint: timestamp.merchantid.orderid.amount.currency.cardnumber
Hash: SHA1(SHA1(blueprint) + shared_secret)
```

See [xmlApiUtils.js:49-73](xmlApiUtils.js#L49-L73) for implementation.

### XML API Operations Used

| Operation | XML API Type | Purpose |
|-----------|--------------|---------|
| **One-Time Payment** | `auth` | Process payment with auto-settle |
| **Customer Creation** | `payer-new` | Create customer in Card Storage |
| **Card Storage** | `card-new` | Store payment method reference |
| **Initial Recurring Payment** | `receipt-in` | First payment with StoredCredential |
| **Schedule Creation** | `schedule-new` | Create recurring schedule |

### StoredCredential Implementation

For recurring payments, the initial transaction includes:

```xml
<recurring>
  <type>fixed</type>
  <sequence>first</sequence>
</recurring>
```

- `type: fixed` - Fixed amount recurring payments
- `sequence: first` - Indicates this is the initial transaction
- Future scheduled payments will have `sequence: subsequent`

See [paymentUtils.js:183-225](paymentUtils.js#L183-L225) for full implementation.

### Payment Scheduler Frequencies

Supported billing frequencies:

| Frontend Value | XML API Schedule | Description |
|----------------|------------------|-------------|
| `weekly` | `weekly` | Every week, same day |
| `bi-weekly` | `? * 6` | Every Saturday (cron format) |
| `monthly` | `monthly` | Same date each month |
| `quarterly` | `quarterly` | Jan, Apr, Jul, Oct |
| `yearly` | `yearly` | Once per year |

See [xmlApiUtils.js:226-243](xmlApiUtils.js#L226-L243) for frequency mapping.

## Testing

### Test Cards (Sandbox)

Use these test cards in the sandbox environment:

| Card Number | Type | Result |
|-------------|------|--------|
| `4263970000005262` | Visa | Success |
| `5425230000004415` | Mastercard | Success |
| `374101000000608` | Amex | Success |

**Test Expiry:** Any future date (e.g., 12/25)
**Test CVV:** Any 3-4 digits (e.g., 123)

### Testing Recurring Payments

1. Navigate to the **Recurring Payments** tab
2. Fill in all required customer information
3. Enter billing address
4. Set subscription amount and frequency
5. Choose a start date (must be future date)
6. Enter test card details
7. Click "Set Up Recurring Payment"

**Expected Flow:**
1. Backend creates customer (payer) in Card Storage
2. Backend creates card reference
3. Backend processes initial payment with StoredCredential
4. Backend creates schedule in Payment Scheduler
5. Frontend displays success message with schedule details

### Verifying Schedule Creation

After successful setup, you'll receive:
- `scheduleRef` - Schedule identifier
- `scheduleText` - Human-readable schedule description
- Payment confirmation with transaction ID

**Note:** In the XML API sandbox, scheduled payments may not execute automatically. For production, Global Payments will process scheduled transactions and send daily reports.

## Security Considerations

### Production Checklist

Before deploying to production:

- [ ] Update `XML_API_ENVIRONMENT=production` in `.env`
- [ ] Use production XML API credentials
- [ ] Implement proper **client-side tokenization** (RealEx HPP or XML API JS SDK)
- [ ] Remove simplified card input forms
- [ ] Add **input validation** and **sanitization**
- [ ] Implement **rate limiting** on API endpoints
- [ ] Add **comprehensive logging** (without logging sensitive data)
- [ ] Set up **HTTPS/TLS** for all communications
- [ ] Implement **CORS** policies appropriately
- [ ] Add **security headers** (helmet.js)
- [ ] Set up **error monitoring** (Sentry, etc.)
- [ ] Implement **webhook signature verification** if using webhooks
- [ ] Add **idempotency** for payment requests
- [ ] Review **PCI DSS compliance** requirements

### PCI Compliance

**Important:** This demo uses simplified card input for demonstration purposes. In production:

1. **Use RealEx Hosted Payment Page (HPP)** for PCI-compliant card collection, OR
2. **Use XML API JavaScript SDK** for client-side tokenization, OR
3. **Obtain PCI SAQ-D certification** if handling raw card data

**Never** store raw card numbers, CVV, or full track data on your servers.

## Troubleshooting

### Common Issues

**Error: "Missing required environment variables"**
- Ensure `.env` file exists with `MERCHANT_ID` and `SHARED_SECRET`

**Error: "Response hash verification failed"**
- Check that your `SHARED_SECRET` is correct
- Ensure system time is synchronized (XML API requires accurate timestamps)

**Error: "Authentication failed"**
- Verify your Merchant ID is correct
- Check that you're using the correct environment (sandbox vs. production)

**Schedule creation fails**
- Ensure start_date is in the future
- Verify customer was created successfully first
- Check that payment method reference was stored

### Debug Mode

Enable detailed logging:

```javascript
// In server.js, add:
console.log('Request data:', JSON.stringify(req.body, null, 2));
```

View XML requests/responses:

```javascript
// In paymentUtils.js, add before axios.post:
console.log('XML Request:', xmlRequest);
```

## Migration from GP-API to XML API

This implementation was migrated from the GP-API (REST) reference. Key differences:

| Aspect | GP-API (REST) | XML API |
|--------|---------------|---------|
| **Format** | JSON | XML |
| **Authentication** | Bearer tokens (OAuth) | HMAC-SHA1 signatures |
| **Endpoints** | Multiple REST endpoints | Single endpoint with message types |
| **SDK** | globalpayments-api (modern) | Custom XML implementation |
| **Tokenization** | /payment-methods endpoint | card-new message type |
| **Recurring** | stored_credential object | \<recurring\> XML element |

## Additional Resources

- [Payment Scheduler Documentation](https://developer.globalpay.com/ecommerce/api/payment-scheduler)
- [Installment Service Documentation](https://developer.globalpay.com/ecommerce/api/installment-service)
- [Card Storage API](https://developer.globalpay.com/ecommerce/api/card-storage)
- [XML API Authentication](https://developer.globalpay.com/ecommerce/api/authentication)

## Support

For technical support with Global Payments XML API:
- Email: [developer support email]
- Documentation: https://developer.globalpay.com
- Sandbox Testing: Use your test credentials from the developer portal

## License

This project is provided as-is for demonstration purposes.
