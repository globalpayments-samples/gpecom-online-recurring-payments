# GP Ecom Online Recurring Payments

> Integrate GP Ecom recurring billing by posting signed XML requests for HPP, card storage, first-payment setup, and schedule creation across Node.js, PHP, Java, and .NET.

## Critical Patterns

1. **Treat this as a direct XML API sample, not an SDK-first sample.** `nodejs/paymentUtils.js`, `php/PaymentUtils.php`, `java/src/main/java/com/globalpayments/payment/PaymentUtils.java`, and `dotnet/PaymentUtils.cs` build XML by hand and post it to `https://api.sandbox.realexpayments.com/epage-remote.cgi` or production. PHP, Java, and .NET still declare GP SDK packages in `composer.json`, `pom.xml`, and `dotnet.csproj`, but the recurring flow is driven by custom XML helpers.
2. **Keep HPP hash inputs narrow.** `generateHPPHash()` in `nodejs/xmlApiUtils.js`, `php/hpp-request.php`, `java/src/main/java/com/globalpayments/xmlapi/XmlApiUtils.java`, and `dotnet/XmlApiUtils.cs` signs only `timestamp.merchantid.orderid.amount.currency`. Node's `server.js` adds recurring-only fields like `PAYER_REF`, `PMT_REF`, and `HPP_SUPPLEMENTARY_DATA`, but those fields are intentionally excluded from the hash.
3. **Convert country formats at the XML boundary.** The browser scripts submit numeric ISO country codes such as `840`; `convertCountryCodeToAlpha2()` in every XML helper converts them to alpha-2 codes before `payer-new` or `receipt-in` requests. If you reuse HPP country values directly in XML, address verification can fail silently.
4. **Node schedule requests depend on element order.** `createRecurringSchedule()` in `nodejs/paymentUtils.js` builds `schedule-new` in schema order and leaves `sha1hash` last. If you refactor that object shape casually, GP Ecom rejects the request even when the hash is correct.

## Repository Structure

### Node.js (Express)
- [`nodejs/server.js`](nodejs/server.js) — main HTTP surface; start with `getXMLAPIConfig()`, `validateConfig()`, and the handlers for `/hpp-request`, `/hpp-recurring-request`, `/hpp-response`, `/hpp-recurring-response`, `/recurring-setup`, and `/process-payment`.
- [`nodejs/paymentUtils.js`](nodejs/paymentUtils.js) — canonical recurring implementation; `processOneTimePayment()`, `createOrUpdateCustomer()`, `createCardReference()`, `storePaymentMethodWithInitialPayment()`, `createRecurringSchedule()`, and `processRecurringPaymentSetup()` show the full XML workflow.
- [`nodejs/xmlApiUtils.js`](nodejs/xmlApiUtils.js) — request signing, country conversion, schedule mapping, XML parsing, and endpoint selection via `generateSHA1Hash()`, `generateHPPHash()`, `mapFrequencyToSchedule()`, and `convertCountryCodeToAlpha2()`.
- [`nodejs/index.html`](nodejs/index.html) and [`nodejs/script.js`](nodejs/script.js) — browser entry point; `initializeHPPPaymentForm()` posts to `/hpp-request`, and `initializeRecurringForm()` posts to `/recurring-setup`.
- [`nodejs/.env.sample`](nodejs/.env.sample) — only sample file that uses `XML_API_ENVIRONMENT` instead of `ENVIRONMENT`.
- [`nodejs/test-api.js`](nodejs/test-api.js) — ad hoc smoke script for `processOneTimePayment()` and `processRecurringPaymentSetup()`.

### PHP (plain PHP)
- [`php/PaymentUtils.php`](php/PaymentUtils.php) — recurring reference flow; `createOrUpdateCustomer()`, `createCardReference()`, `storePaymentMethodWithInitialPayment()`, `createRecurringSchedule()`, and `processRecurringPaymentSetup()` mirror the Node XML requests.
- [`php/XmlApiUtils.php`](php/XmlApiUtils.php) — hash builders, frequency mapping, numeric-to-alpha-2 conversion, and endpoint selection via `generateSha1Hash()`, `mapFrequencyToSchedule()`, and `convertCountryCodeToAlpha2()`.
- [`php/hpp-request.php`](php/hpp-request.php) — `generateHPPHash()` and the JSON response used by the HPP frontend.
- [`php/hpp-response.php`](php/hpp-response.php) — HPP callback verification through `generateHPPResponseHash()`.
- [`php/recurring-setup.php`](php/recurring-setup.php) — JSON API for direct recurring setup; loads config, validates request shape, and calls `PaymentUtils::processRecurringPaymentSetup()`.
- [`php/process-payment.php`](php/process-payment.php) — legacy one-time endpoint; it calls `PaymentUtils::processOneTimePayment()`, but that method does not exist in `php/PaymentUtils.php`, so do not document it as working parity.
- [`php/config.php`](php/config.php), [`php/index.html`](php/index.html), and [`php/script.js`](php/script.js) — frontend-facing config/message endpoint and browser assets.

### Java (Jakarta Servlet)
- [`java/src/main/java/com/globalpayments/payment/PaymentUtils.java`](java/src/main/java/com/globalpayments/payment/PaymentUtils.java) — recurring reference flow; `processRecurringPaymentSetup()` orchestrates `createOrUpdateCustomer()`, `createCardReference()`, `storePaymentMethodWithInitialPayment()`, and `createRecurringSchedule()`.
- [`java/src/main/java/com/globalpayments/xmlapi/XmlApiUtils.java`](java/src/main/java/com/globalpayments/xmlapi/XmlApiUtils.java) — hash generation, country conversion, schedule mapping, and XML parsing.
- [`java/src/main/java/com/globalpayments/example/HPPRequestServlet.java`](java/src/main/java/com/globalpayments/example/HPPRequestServlet.java) — `doPost()` builds HPP request JSON for `/hpp-request`.
- [`java/src/main/java/com/globalpayments/example/HPPResponseServlet.java`](java/src/main/java/com/globalpayments/example/HPPResponseServlet.java) — `doPost()`, `renderSuccessPage()`, and `renderErrorPage()` handle `/hpp-response`.
- [`java/src/main/java/com/globalpayments/example/RecurringPaymentServlet.java`](java/src/main/java/com/globalpayments/example/RecurringPaymentServlet.java) — `doPost()` handles `/recurring-setup`.
- [`java/src/main/java/com/globalpayments/example/ProcessPaymentServlet.java`](java/src/main/java/com/globalpayments/example/ProcessPaymentServlet.java) — despite the class name, `doGet()` only serves `/config`; there is no Java `/process-payment` endpoint.
- [`java/src/main/java/com/globalpayments/example/StartupListener.java`](java/src/main/java/com/globalpayments/example/StartupListener.java) — startup banner and default port logging.
- [`java/src/main/webapp/index.html`](java/src/main/webapp/index.html) and [`java/src/main/webapp/script.js`](java/src/main/webapp/script.js) — browser UI.

### .NET (ASP.NET Core minimal app)
- [`dotnet/Program.cs`](dotnet/Program.cs) — endpoint wiring through `ConfigureHPPRequestEndpoint()`, `ConfigureHPPResponseEndpoint()`, and `ConfigureRecurringEndpoint()`; there is no mapped `/config`, `/health`, or `/process-payment` route even though the startup banner says otherwise.
- [`dotnet/PaymentUtils.cs`](dotnet/PaymentUtils.cs) — recurring reference flow; `ProcessRecurringPaymentSetup()` orchestrates `CreateOrUpdateCustomer()`, `CreateCardReference()`, `StorePaymentMethodWithInitialPayment()`, and `CreateRecurringSchedule()`.
- [`dotnet/XmlApiUtils.cs`](dotnet/XmlApiUtils.cs) — hash builders, frequency mapping, country conversion, endpoint selection, and XML parsing.
- [`dotnet/wwwroot/index.html`](dotnet/wwwroot/index.html) and [`dotnet/wwwroot/script.js`](dotnet/wwwroot/script.js) — browser UI served by static files.
- [`dotnet/.env.sample`](dotnet/.env.sample) and [`dotnet/run.sh`](dotnet/run.sh) — runtime defaults for local execution.

### Shared and cross-cutting
- [`README.md`](README.md) — useful orientation, but it overstates endpoint parity and SDK usage; trust source files first.
- [`docker-compose.yml`](docker-compose.yml) — stale multi-service file; it references `python/`, `go/`, `PUBLIC_API_KEY`, and `SECRET_API_KEY`, which do not match the checked-in recurring implementations.
- [`index.html`](index.html) — generic root page that is not the same file served by the per-language apps.
- Present languages: `nodejs`, `php`, `java`, `dotnet`. Absent but still mentioned in `docker-compose.yml`: `python`, `go`.

## API Surface

| Method | Path | Implementations | Purpose |
| --- | --- | --- | --- |
| GET | `/config` | Node, Java | Return a minimal XML-API config message or merchant/environment payload. |
| GET | `/config.php` | PHP | PHP equivalent config message. |
| GET | `/health` | Node only | Validate Node env vars and report XML API environment. |
| POST | `/hpp-request` | Node, Java, .NET | Build signed HPP request JSON for one-time browser payments. |
| POST | `/hpp-request.php` | PHP | PHP HPP request generator. |
| POST | `/hpp-response` | Node, Java, .NET | Verify HPP callback hash and render success or failure HTML. |
| POST | `/hpp-response.php` | PHP | PHP HPP callback handler. |
| POST | `/hpp-recurring-request` | Node only | Build HPP request JSON with `OFFER_SAVE_CARD`, `PAYER_REF`, and `PMT_REF` for recurring setup. |
| POST | `/hpp-recurring-response` | Node only | Finish recurring setup after HPP saves the card and then call `createRecurringSchedule()`. |
| POST | `/recurring-setup` | Node, Java, .NET | Direct JSON API for payer creation, card storage, first payment, and schedule creation. |
| POST | `/recurring-setup.php` | PHP | PHP direct recurring setup endpoint. |
| POST | `/process-payment` | Node only | Legacy one-time payment API that accepts `payment_token`. |
| POST | `/process-payment.php` | PHP only, currently broken | Intended one-time payment API, but it references a missing `PaymentUtils::processOneTimePayment()`. |

## Environment Variables

Node.js (`nodejs/.env.sample`):
- `MERCHANT_ID` — required GP Ecom merchant ID.
- `SHARED_SECRET` — required XML/HPP signing secret.
- `ACCOUNT` — optional account name; defaults to `internet`.
- `XML_API_ENVIRONMENT` — Node-only environment selector; defaults to `sandbox`.
- `PORT` — listener port; defaults to `8000`.

PHP, Java, and .NET (`php/.env.sample`, `java/.env.sample`, `dotnet/.env.sample`):
- `MERCHANT_ID` — required GP Ecom merchant ID.
- `SHARED_SECRET` — required XML/HPP signing secret.
- `ACCOUNT` — optional account name; defaults to `internet`.
- `ENVIRONMENT` — environment selector; defaults to `sandbox`.
- `PORT` — listener port; defaults to `8000`.

The three non-Node samples keep identical `.env.sample` files; Node is the only implementation that swaps `ENVIRONMENT` for `XML_API_ENVIRONMENT`.

## Sandbox Credentials and Test Cards

The repo is GP Ecom, not GP API. The sample `.env.sample` files use `MERCHANT_ID=radoslav`, `SHARED_SECRET=cfJeww9HL2`, and `ACCOUNT=internet` as sandbox credentials copied from GP Ecom recurring tests.

| Brand | Number | CVV | Notes |
| --- | --- | --- | --- |
| Visa | `4263970000005262` | `123` | Approved in every browser script. |
| Visa | `4000120000001154` | `123` | Declined path in browser scripts. |
| Mastercard | `5425230000004415` | `123` | Approved in browser scripts and READMEs. |
| Mastercard | `5114610000004778` | `123` | Declined path in browser scripts. |
| Amex | `374101000000608` | `1234` | Approved in browser scripts and READMEs. |
| Discover | `6011000000000087` | `123` | Approved path in browser scripts. |

Get real sandbox or production GP Ecom credentials from <https://developer.globalpayments.com> or your Global Payments contact.

## API Request Shape

- Endpoint URL: `XmlApiUtils::getXmlApiEndpoint()` / `getXMLAPIEndpoint()` / `GetXmlApiEndpoint()` select `https://api.sandbox.realexpayments.com/epage-remote.cgi` for sandbox and `https://api.realexpayments.com/epage-remote.cgi` for production.
- Transport: every backend posts raw XML with `Content-Type: application/xml`; there is no bearer token or OAuth layer.
- Request types: recurring setup always chains `payer-new` → `card-new` → `receipt-in` → `schedule-new`.
- Hash blueprints matter: `receipt-in` signs `timestamp.merchantid.orderid.amount.currency.payerref`; `schedule-new` signs `timestamp.merchantid.scheduleref.amount.currency.payerref.schedule`.
- Country handling matters: HPP/browser payloads use numeric ISO country codes, but XML payer and TSS nodes use alpha-2 after conversion.

## Architecture Summary

- **Direct recurring setup:** browser `script.js` → `/recurring-setup` or `/recurring-setup.php` → `processRecurringPaymentSetup()` / `ProcessRecurringPaymentSetup()` → `payer-new` + `card-new` + `receipt-in` + `schedule-new`.
- **One-time HPP flow:** browser `initializeHPPPaymentForm()` → `/hpp-request` (or `/hpp-request.php`) → hosted payment page → `/hpp-response` (or `/hpp-response.php`) for hash verification and HTML confirmation.
- **Node HPP recurring flow:** browser can use `/hpp-recurring-request` → hosted payment page saves card → `/hpp-recurring-response` → `createRecurringSchedule()`.

## Security Notes

This is demo code. Card details are posted directly to backend recurring endpoints, SSL peer verification is disabled in PHP cURL calls, and there is no auth, CSRF protection, persistence layer, or secret management beyond local `.env` files. Use HPP or another PCI-scoped collection method before adapting this for production.

## How to Run

- Node: from `nodejs/`, run `./run.sh`; local default is `http://localhost:8000`.
- PHP: from `php/`, run `./run.sh`; local default is `http://localhost:8000`.
- Java: from `java/`, run `./run.sh`; Cargo serves Tomcat on `http://localhost:8000`.
- .NET: from `dotnet/`, run `./run.sh`; `Program.cs` falls back to port `8000`.
- Docker: `docker-compose.yml` is not a reliable source of truth for this repo without cleanup.

## How to Verify

```bash
# Node /config
curl http://localhost:8000/config
# Expected in Node: {"success":true,"data":{"merchantId":"...","environment":"sandbox"},...}

# Java /config
curl http://localhost:8000/config
# Expected in Java: {"success":true,"message":"XML API does not require client-side configuration"}

# PHP /config.php
curl http://localhost:8000/config.php
# Expected: {"success":true,"message":"XML API does not require client-side configuration"}

# Node /health
curl http://localhost:8000/health
# Expected: {"status":"healthy","environment":"sandbox",...}

# Node /hpp-request (Java and .NET use the same path and request body)
curl -X POST http://localhost:8000/hpp-request \
  -H "Content-Type: application/json" \
  -d '{"amount":10.00,"currency":"USD","customer_email":"john.smith@example.com"}'
# Expected: {"success":true,"data":{"TIMESTAMP":"...","MERCHANT_ID":"...","ORDER_ID":"...","MERCHANT_RESPONSE_URL":"...","SHA1HASH":"..."},...}

# PHP /hpp-request.php
curl -X POST http://localhost:8000/hpp-request.php \
  -H "Content-Type: application/json" \
  -d '{"amount":10.00,"currency":"USD","customer_email":"john.smith@example.com"}'
# Expected: {"success":true,"message":"HPP request generated successfully","data":{"TIMESTAMP":"...","MERCHANT_ID":"...",...}}

# Node-only /hpp-recurring-request
curl -X POST http://localhost:8000/hpp-recurring-request \
  -H "Content-Type: application/json" \
  -d '{"amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2030-01-01","customer_email":"john.smith@example.com"}'
# Expected: {"success":true,"data":{"OFFER_SAVE_CARD":"1","PAYER_REF":"CUS...","PMT_REF":"PMT...","HPP_SUPPLEMENTARY_DATA":"..."},...}

# Node /recurring-setup (Java and .NET use the same JSON shape at /recurring-setup)
curl -X POST http://localhost:8000/recurring-setup \
  -H "Content-Type: application/json" \
  -d '{"card_number":"4263970000005262","card_expiry":"12/25","card_cvv":"123","amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2030-01-01","first_name":"John","last_name":"Smith","email":"john.smith@example.com","phone":"555-123-4567","street_address":"123 Main Street","city":"New York","state":"NY","billing_zip":"10001","billing_country":"840"}'
# Expected on success: {"success":true,"data":{"customer":{"payerRef":"CUS..."},"payment":{"transactionId":"..."},"schedule":{"scheduleRef":"..."}},...}

# PHP /recurring-setup.php
curl -X POST http://localhost:8000/recurring-setup.php \
  -H "Content-Type: application/json" \
  -d '{"card_number":"4263970000005262","card_expiry":"12/25","card_cvv":"123","amount":29.99,"currency":"USD","frequency":"monthly","start_date":"2030-01-01","first_name":"John","last_name":"Smith","email":"john.smith@example.com","phone":"555-123-4567","street_address":"123 Main Street","city":"New York","state":"NY","billing_zip":"10001","billing_country":"840"}'
# Expected on success: {"success":true,"data":{"customer":{"payerRef":"CUS..."},"payment":{"transactionId":"..."},"schedule":{"scheduleRef":"..."}},...}

# Node-only /process-payment
curl -X POST http://localhost:8000/process-payment \
  -H "Content-Type: application/json" \
  -d '{"payment_token":{"number":"4263970000005262","expmonth":"12","expyear":"25","cvn":"123","chname":"John Smith"},"amount":10.00,"currency":"USD"}'
# Expected on success: {"success":true,"data":{"transactionId":"...","orderId":"...","authCode":"..."},...}

# PHP-only /process-payment.php (currently broken)
curl -X POST http://localhost:8000/process-payment.php \
  -F 'payment_token={"number":"4263970000005262","expmonth":"12","expyear":"25","cvn":"123","chname":"John Smith"}' \
  -F 'amount=10.00' \
  -F 'currency=USD'
# Expected today: server error because the file calls missing method PaymentUtils::processOneTimePayment().
```

Browser-only paths: `/hpp-response`, `/hpp-response.php`, and Node's `/hpp-recurring-response` are callback endpoints; verify them with a real HPP redirect rather than curl.

## Making Changes

The recurring workflow is intended to stay aligned across all four implementations. If you change payer creation, card storage, first-payment handling, schedule creation, or HPP request signing in one language, port the same behavior to `nodejs/paymentUtils.js`, `php/PaymentUtils.php`, `java/src/main/java/com/globalpayments/payment/PaymentUtils.java`, and `dotnet/PaymentUtils.cs` unless the route is intentionally absent there. Keep per-language frontend files in sync when changing UI behavior: `nodejs/index.html`, `php/index.html`, `java/src/main/webapp/index.html`, and `dotnet/wwwroot/index.html`. Do not change `docker-compose.yml` or the root `index.html` in isolation unless you also verify the stale service references and duplicated frontend copies.

## SDK Versions

- Node: no GP SDK dependency; XML requests use `axios` 1.6.x and `xml2js` 0.6.x.
- PHP: `globalpayments/php-sdk` ^13.1 is declared, but recurring XML requests are hand-built.
- Java: `com.heartlandpaymentsystems:globalpayments-sdk` 14.2.20 is declared, but recurring XML requests are hand-built.
- .NET: `GlobalPayments.Api` 9.0.16 is declared, but recurring XML requests are hand-built.
- Runtime targets in repo: Node module app, PHP 8-style sample, Java source/target 23, and `.NET` target framework `net9.0`.