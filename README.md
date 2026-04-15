# GP Ecom Online Recurring Payments

A complete recurring payment implementation using the Global Payments GP Ecom (XML API) gateway. Developers can process one-time charges, store cards in the GP Card Storage vault, and set up automated recurring billing schedules — all via XML-authenticated requests to the RealEx/eCommerce API endpoint.

Available in four languages: PHP, Node.js, .NET, and Java.

---

## Available Implementations

| Language | Framework | Integration |
|----------|-----------|-------------|
| [**PHP**](./php/) | Built-in Server | Direct XML API (cURL) |
| [**Node.js**](./nodejs/) | Express.js | Direct XML API (axios) |
| [**.NET**](./dotnet/) | ASP.NET Core | Direct XML API (HttpClient) |
| [**Java**](./java/) | Jakarta Servlet | Direct XML API (HttpClient) |

Preview links (runs in browser via CodeSandbox):
- [PHP Preview](https://githubbox.com/globalpayments-samples/gpecom-online-recurring-payments/tree/main/php)
- [Node.js Preview](https://githubbox.com/globalpayments-samples/gpecom-online-recurring-payments/tree/main/nodejs)
- [.NET Preview](https://githubbox.com/globalpayments-samples/gpecom-online-recurring-payments/tree/main/dotnet)
- [Java Preview](https://githubbox.com/globalpayments-samples/gpecom-online-recurring-payments/tree/main/java)

---

## GP Ecom vs GP API

This project uses the **GP Ecom (XML API)** gateway — a different integration path from the REST-based GP API used in most other samples. Key differences:

| | GP Ecom (this project) | GP API |
|--|------------------------|--------|
| Protocol | XML over HTTPS | REST/JSON |
| Auth | HMAC SHA-1 signature per request | OAuth2 access token |
| Credentials | `MERCHANT_ID` + `SHARED_SECRET` | `APP_ID` + `APP_KEY` |
| Recurring | Card Storage vault + `payer-*` references | `StoredCredential` object |
| HPP | Hosted Payment Page available | Drop-In UI |
| Endpoint | `api.sandbox.realexpayments.com` | `apis.sandbox.globalpay.com` |

---

## How It Works

GP Ecom recurring payments use the Card Storage service. The first transaction stores the card under a named payer reference; all future charges use that reference instead of card data.

```
Browser
  │
  ├─ GET /config ──────────────────► Server
  │                                    └─ Returns Merchant ID + environment
  │  ◄── { merchantId, environment } ──┘
  │
  ├─ User enters card details in payment form
  │
  ├─ POST /process-payment ────────► Server (one-time)
  │   { card_number, card_expiry,       └─ SDK: CreditCardData.charge()
  │     card_cvv, amount, currency }         .withGpEcomConfig()
  │  ◄── { transactionId, status } ──────────┘        .execute()
  │
  └─ POST /recurring-setup ────────► Server (recurring)
      { card_number, card_expiry,       ├─ 1. Create customer (payer) in Card Storage
        card_cvv, amount,               ├─ 2. Store card reference under payer
        customer info, frequency,       ├─ 3. Process initial charge
        start_date }                    └─ 4. Create recurring schedule
     ◄── { payerRef, cardRef,
            scheduleId, transactionId } ──┘
```

Each future recurring charge references `payerRef` + `cardRef` — no card data needed after the initial setup.

---

## Prerequisites

- Global Payments GP Ecom account — contact [Global Payments](https://developer.globalpayments.com) for XML API credentials
- GP Ecom credentials: `Merchant ID`, `Shared Secret`, and `Account` (usually `internet`)
- A local runtime for your chosen language:
  - PHP 8.0+ with Composer
  - Node.js 18+ with npm
  - .NET 8.0 SDK
  - Java 17+ with Maven

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/globalpayments-samples/gpecom-online-recurring-payments.git
cd gpecom-online-recurring-payments
```

### 2. Choose a language and configure credentials

```bash
cd php       # or nodejs, dotnet, java
cp .env.sample .env
```

Edit `.env`:

```env
MERCHANT_ID=your_merchant_id_here
SHARED_SECRET=your_shared_secret_here
ACCOUNT=internet
ENVIRONMENT=sandbox
```

### 3. Install and run

**PHP:**
```bash
composer install
php -S localhost:8003
```
Open: http://localhost:8003

**Node.js:**
```bash
npm install
npm start
```
Open: http://localhost:8001

**.NET:**
```bash
dotnet restore
dotnet run
```
Open: http://localhost:8006

**Java:**
```bash
mvn clean package
mvn cargo:run
```
Open: http://localhost:8004

### 4. Test a recurring payment setup

1. Open the app and select **Recurring Payment**
2. Enter amount (e.g. `25.00`) and customer details
3. Choose frequency (e.g. **Monthly**) and start date
4. Enter a test card (see [Test Cards](#test-cards) below)
5. Submit — note the `payerRef` and `cardRef` in the response
6. Future charges use those references, no card re-entry required

---

## Docker Setup

Run all four language implementations simultaneously:

```bash
# Copy env to root (used by all services)
cp php/.env.sample .env
# Edit .env with your credentials, then:
docker-compose up
```

Individual services:

```bash
docker-compose up nodejs    # http://localhost:8001
docker-compose up php       # http://localhost:8003
docker-compose up java      # http://localhost:8004
docker-compose up dotnet    # http://localhost:8006
```

Run integration tests (requires all services healthy):

```bash
docker-compose --profile testing up
```

Test results written to `./test-results/` and `./playwright-report/`.

---

## API Endpoints

### `GET /config`

Returns Merchant ID and environment for frontend initialization.

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "your_merchant_id",
    "environment": "sandbox"
  }
}
```

---

### `POST /process-payment`

Processes a one-time card payment via the XML API.

**Request body:**
```json
{
  "card_number": "4263970000005262",
  "card_expiry": "1225",
  "card_cvv": "123",
  "amount": 25.00,
  "currency": "USD"
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "ABC123",
    "authCode": "12345",
    "amount": 25.00,
    "currency": "USD",
    "status": "00",
    "message": "[ test system ] Authorised"
  }
}
```

---

### `POST /recurring-setup`

Creates a recurring payment schedule. Stores the customer and card in Card Storage, processes the initial charge, and sets up the billing schedule.

**Request body:**
```json
{
  "card_number": "4263970000005262",
  "card_expiry": "1225",
  "card_cvv": "123",
  "amount": 25.00,
  "currency": "USD",
  "frequency": "Monthly",
  "start_date": "2025-02-01",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "555-0100",
  "street_address": "123 Main St",
  "city": "Atlanta",
  "state": "GA",
  "billing_zip": "30301"
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "ABC456",
    "payerRef": "CUST_jane_smith_uuid",
    "cardRef": "CARD_visa_uuid",
    "scheduleId": "SCH_monthly_uuid",
    "amount": 25.00,
    "currency": "USD",
    "frequency": "Monthly",
    "startDate": "2025-02-01",
    "authCode": "12345",
    "status": "active",
    "message": "Initial payment successful. Recurring schedule created."
  }
}
```

**Supported frequency values:** `Weekly`, `Bi-Weekly`, `Monthly`, `Quarterly`, `Annually`

---

### `GET /hpp-request` + `POST /hpp-response`

Optional HPP (Hosted Payment Page) flow. The server generates a signed HPP request; after payment, GP Ecom posts the result to `/hpp-response` for server-side validation of the HMAC signature.

---

## Test Cards

Use these in sandbox (`ENVIRONMENT=sandbox`). Expiry: any future date in `MMYY` format.

| Brand | Card Number | CVV | Expected Result |
|-------|-------------|-----|-----------------|
| Visa | 4263 9700 0000 5262 | 123 | Approved |
| Visa | 4000 0000 0000 0002 | 123 | Approved |
| Mastercard | 5425 2300 0000 4415 | 123 | Approved |
| Amex | 3714 4963 5398 431 | 1234 | Approved |
| Declined | 4000 1200 0000 1154 | 123 | Declined |

> Sandbox transactions do not move real money. Use only sandbox credentials with test cards.

---

## Project Structure

```
gpecom-online-recurring-payments/
├── index.html                  # Shared frontend (served by all backends)
├── docker-compose.yml          # Multi-service Docker config
├── Dockerfile.tests            # Playwright test runner
├── LICENSE
├── README.md
│
├── php/                        # Port 8003
│   ├── .env.sample
│   ├── composer.json
│   ├── Dockerfile
│   ├── PaymentUtils.php        # SDK config + shared helpers
│   ├── XmlApiUtils.php         # HMAC signature + XML request helpers
│   ├── config.php              # GET /config endpoint
│   ├── process-payment.php     # POST /process-payment endpoint
│   ├── recurring-setup.php     # POST /recurring-setup endpoint
│   ├── hpp-request.php         # GET /hpp-request (HPP flow)
│   ├── hpp-response.php        # POST /hpp-response (HPP callback)
│   └── script.js               # Frontend JS
│
├── nodejs/                     # Port 8001
│   ├── .env.sample
│   ├── package.json
│   ├── Dockerfile
│   └── server.js               # Express app: all endpoints
│
├── dotnet/                     # Port 8006
│   ├── .env.sample
│   ├── *.csproj
│   ├── Program.cs              # ASP.NET Core: all endpoints
│   ├── Dockerfile
│   └── wwwroot/
│
└── java/                       # Port 8004
    ├── .env.sample
    ├── pom.xml
    ├── Dockerfile
    └── src/
        └── main/java/com/globalpayments/example/
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MERCHANT_ID` | Your GP Ecom Merchant ID | `radoslav` |
| `SHARED_SECRET` | HMAC signing secret | `cfJeww9HL2` |
| `ACCOUNT` | Account descriptor (usually `internet`) | `internet` |
| `ENVIRONMENT` | `sandbox` for testing, `production` for live | `sandbox` |

Credentials are available from your Global Payments account manager or the [GP Developer Portal](https://developer.globalpayments.com).

**Sandbox API endpoint:** `https://api.sandbox.realexpayments.com/epage-remote.cgi`
**Production API endpoint:** `https://api.realexpayments.com/epage-remote.cgi`

---

## Troubleshooting

**`508` — Bad signature**
The HMAC signature doesn't match. Verify `SHARED_SECRET` in `.env` exactly matches what's configured in the GP Ecom merchant portal. Leading/trailing whitespace in the secret is a common cause.

**`504` — Order ID already exists**
GP Ecom rejects duplicate order IDs within a short window. The SDK auto-generates unique order IDs — if you're seeing this, ensure you're not replaying the same request.

**`102` — Card declined in sandbox**
Try a different card from the [Test Cards](#test-cards) table. The GP Ecom sandbox has limited test card support compared to GP API.

**Recurring setup fails at step 2 (card storage)**
Card Storage must be enabled on your Merchant ID. Contact your account manager if you have a new sandbox account and recurring setup fails with `501 Not Enrolled`.

**`MERCHANT_ID not set` error on startup**
The `.env` file is missing or not loaded. Confirm the file exists in the language directory (e.g. `php/.env`) and all three required variables are set.

**Port already in use**
Check with `lsof -i :8003` (or the relevant port) and stop the conflicting process, or update the port mapping in `docker-compose.yml`.

## Community

- 🌐 **Developer Portal** — [developer.globalpayments.com](https://developer.globalpayments.com)
- 💬 **Discord** — [Join the community](https://discord.gg/myER9G9qkc)
- 📋 **GitHub Discussions** — [github.com/orgs/globalpayments/discussions](https://github.com/orgs/globalpayments/discussions)
- 📧 **Newsletter** — [Subscribe](https://www.globalpayments.com/en-gb/modals/newsletter)
- 💼 **LinkedIn** — [Global Payments for Developers](https://www.linkedin.com/showcase/global-payments-for-developers/posts/?feedView=all)

Have a question or found a bug? [Open an issue](https://github.com/globalpayments-samples/gpecom-online-recurring-payments/issues) or reach out at [communityexperience@globalpay.com](mailto:communityexperience@globalpay.com).

---

## License

MIT — see [LICENSE](./LICENSE).
