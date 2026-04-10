# GP Ecom Online Recurring Payments — .NET

ASP.NET Core implementation of recurring payment processing using the Global Payments XML API (GP Ecom) with Card Storage and Payment Scheduler services.

Part of the [gpecom-online-recurring-payments](../) multi-language project.

---

## Requirements

- .NET 8.0 SDK
- Global Payments GP Ecom credentials (`MERCHANT_ID`, `SHARED_SECRET`, `ACCOUNT`)

---

## Project Structure

```
dotnet/
├── .env.sample              # Environment variable template
├── dotnet.csproj            # Dependencies (GlobalPayments.Api, DotNetEnv)
├── appsettings.json         # ASP.NET Core config
├── Program.cs               # App entry point + all endpoints
├── XmlApiUtils.cs           # HMAC SHA-1 signature + XML request helpers
├── PaymentUtils.cs          # SDK config + payment workflow
├── Dockerfile
├── run.sh                   # Restore + run shortcut
└── wwwroot/                 # Static frontend files
```

---

## Setup

```bash
cp .env.sample .env
```

Edit `.env`:

```env
MERCHANT_ID=your_merchant_id
SHARED_SECRET=your_shared_secret
ACCOUNT=internet
ENVIRONMENT=sandbox
```

Install dependencies:

```bash
dotnet restore
```

Start the server:

```bash
dotnet run
# or
./run.sh
```

Open: http://localhost:8006

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MERCHANT_ID` | Your GP Ecom Merchant ID | `radoslav` |
| `SHARED_SECRET` | HMAC signing secret | `cfJeww9HL2` |
| `ACCOUNT` | Account descriptor | `internet` |
| `ENVIRONMENT` | `sandbox` or `production` | `sandbox` |

Credentials available from your Global Payments account manager or the [GP Developer Portal](https://developer.globalpayments.com).

---

## SDK Configuration

`Program.cs` configures `GpEcomConfig` from environment variables using `DotNetEnv`:

```csharp
Env.Load();

var config = new GpEcomConfig
{
    MerchantId  = Environment.GetEnvironmentVariable("MERCHANT_ID"),
    AccountId   = Environment.GetEnvironmentVariable("ACCOUNT"),
    SharedSecret = Environment.GetEnvironmentVariable("SHARED_SECRET"),
    Environment = GpEnvironment.TEST
};

ServicesContainer.ConfigureService(config);
```

All XML API requests use HMAC SHA-1 authentication — see `XmlApiUtils.cs` for signature generation.

---

## Endpoints

### `GET /config` — `Program.cs`

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

### `POST /process-payment` — `Program.cs`

One-time card charge via the XML API.

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

### `POST /recurring-setup` — `Program.cs`

4-step recurring setup: creates customer, stores card, processes initial charge, schedules future billing.

**Request body:**
```json
{
  "card_number": "4263970000005262",
  "card_expiry": "1225",
  "card_cvv": "123",
  "card_name": "Jane Smith",
  "amount": 25.00,
  "currency": "USD",
  "frequency": "Monthly",
  "start_date": "2025-02-01",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "555-0100",
  "billing_zip": "30301",
  "billing_country": "840"
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "payerRef": "CUS_jane_smith_uuid",
      "name": "Jane Smith",
      "email": "jane.smith@example.com"
    },
    "payment": {
      "transactionId": "TRN_abc123",
      "orderId": "INIT_abc123",
      "authCode": "12345",
      "amount": 25.00,
      "currency": "USD"
    },
    "schedule": {
      "scheduleRef": "SCH_monthly_uuid",
      "frequency": "Monthly",
      "startDate": "2025-02-01",
      "amount": 25.00,
      "currency": "USD"
    }
  }
}
```

Supported `frequency` values: `Weekly`, `Bi-Weekly`, `Monthly`, `Quarterly`, `Annually`

---

## 4-Step Recurring Workflow

| Step | XML Request | Description |
|------|-------------|-------------|
| 1 | `payer-new` | Create customer in Card Storage |
| 2 | `card-new` | Store card reference under customer |
| 3 | `receipt-in` | Process initial charge (sequence: first) |
| 4 | `schedule-new` | Create recurring billing schedule |

Future charges reference `payerRef` + `cardRef` — no card data needed.

---

## Test Cards

Use these in sandbox (`ENVIRONMENT=sandbox`). Expiry: any future date in `MMYY` format.

| Brand | Card Number | CVV | Expected Result |
|-------|-------------|-----|-----------------|
| Visa | 4263 9700 0000 5262 | 123 | Approved |
| Mastercard | 5425 2300 0000 4415 | 123 | Approved |
| Amex | 3741 0100 0000 608 | 1234 | Approved |
| Declined | 4000 1200 0000 1154 | 123 | Declined |

---

## Running with Docker

```bash
# From project root
docker-compose up dotnet
```

Runs on http://localhost:8006 (mapped from container port 8000 via `ASPNETCORE_URLS`).

---

## Troubleshooting

**`508` — Bad signature**
Verify `SHARED_SECRET` in `.env` exactly matches the GP Ecom merchant portal. Leading/trailing whitespace is a common cause.

**`504` — Order ID already exists**
The SDK auto-generates unique order IDs. If this happens, ensure you're not replaying the same request payload.

**`501 Not Enrolled` on recurring setup**
Card Storage must be enabled on your Merchant ID. Contact your account manager for new sandbox accounts.

**`DotNetEnv` package missing**
Run `dotnet restore` to install NuGet packages before running.

**Port conflict on 8006**
Override: `dotnet run --urls http://localhost:9000`. Update Docker port mapping accordingly.

**.NET version mismatch**
Requires .NET 8.0 SDK. Check with `dotnet --version`. Use the Docker container if local SDK is older.
