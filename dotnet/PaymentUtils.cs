using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace CardPaymentSample;

/// <summary>
/// Payment Processing Utilities for XML API
///
/// This class handles:
/// - One-time payment processing
/// - Recurring payment setup
/// - Customer and payment method storage
/// - Payment Scheduler integration
/// </summary>
public static class PaymentUtils
{
    private static readonly HttpClient httpClient = new();

    /// <summary>
    /// Create or update customer (payer) in Card Storage
    /// </summary>
    public static async Task<Dictionary<string, object>> CreateOrUpdateCustomer(
        Dictionary<string, string> config,
        Dictionary<string, object> customerData)
    {
        var merchantId = config["merchantId"];
        var sharedSecret = config["sharedSecret"];
        var environment = config.GetValueOrDefault("environment", "sandbox");

        var payerRef = (string)customerData["payerRef"];
        var firstName = customerData.GetValueOrDefault("firstName", "")?.ToString() ?? "";
        var lastName = customerData.GetValueOrDefault("lastName", "")?.ToString() ?? "";
        var email = customerData.GetValueOrDefault("email", "")?.ToString() ?? "";
        var phone = customerData.GetValueOrDefault("phone", "")?.ToString() ?? "";
        var address = customerData.GetValueOrDefault("address", new Dictionary<string, string>()) as Dictionary<string, string>
                      ?? new Dictionary<string, string>();

        var timestamp = XmlApiUtils.GenerateTimestamp();
        var orderId = XmlApiUtils.GenerateOrderId("CUST");

        // Generate hash for payer-new
        var hashVal = XmlApiUtils.GeneratePayerNewHash(timestamp, merchantId, orderId, payerRef, sharedSecret);

        // Build XML request
        var request = new XElement("request",
            new XAttribute("type", "payer-new"),
            new XAttribute("timestamp", timestamp),
            new XElement("merchantid", merchantId),
            new XElement("orderid", orderId),
            new XElement("payer",
                new XAttribute("type", "Retail"),
                new XAttribute("ref", payerRef),
                new XElement("title", ""),
                new XElement("firstname", XmlApiUtils.SanitizeAlphanumeric(firstName, 100)),
                new XElement("surname", XmlApiUtils.SanitizeAlphanumeric(lastName, 100)),
                new XElement("company", "")
            ),
            new XElement("sha1hash", hashVal)
        );

        // Add address if provided
        if (address.Any())
        {
            var countryCode = XmlApiUtils.ConvertCountryCodeToAlpha2(address.GetValueOrDefault("country", "US"));
            var addressElement = new XElement("address",
                new XElement("line1", XmlApiUtils.SanitizeAlphanumeric(address.GetValueOrDefault("street_address", ""), 50)),
                new XElement("line2", ""),
                new XElement("line3", ""),
                new XElement("city", XmlApiUtils.SanitizeAlphanumeric(address.GetValueOrDefault("city", ""), 40)),
                new XElement("county", XmlApiUtils.SanitizeAlphanumeric(address.GetValueOrDefault("state", ""), 40)),
                new XElement("postcode", XmlApiUtils.SanitizePostalCode(address.GetValueOrDefault("billing_zip", ""))),
                new XElement("country",
                    new XAttribute("code", countryCode),
                    countryCode
                )
            );
            request.Element("payer")!.Add(addressElement);
        }

        // Add phone if provided
        if (!string.IsNullOrEmpty(phone))
        {
            var phoneElement = new XElement("phonenumbers",
                new XElement("home", XmlApiUtils.SanitizeAlphanumeric(phone, 20))
            );
            request.Element("payer")!.Add(phoneElement);
        }

        // Add email
        request.Element("payer")!.Add(new XElement("email", XmlApiUtils.SanitizeAlphanumeric(email, 255)));

        // Send request
        var xmlRequest = request.ToString(SaveOptions.DisableFormatting);
        var endpoint = XmlApiUtils.GetXmlApiEndpoint(environment);

        Console.WriteLine($"📤 [Customer] Sending XML request to: {endpoint}");

        var content = new StringContent(xmlRequest, Encoding.UTF8, "application/xml");
        var response = await httpClient.PostAsync(endpoint, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        var parsedResponse = XmlApiUtils.ParseXmlResponse(responseBody);
        Console.WriteLine($"📥 [Customer] Parsed response: {string.Join(", ", parsedResponse.Select(kv => $"{kv.Key}={kv.Value}"))}");

        // Check result (00 = success, 501 = payer already exists - both acceptable)
        var result = parsedResponse["result"];
        if (result != "00" && result != "501")
        {
            throw new Exception($"Customer creation failed: {parsedResponse["message"]} (Code: {result})");
        }

        return new Dictionary<string, object>
        {
            { "success", true },
            { "payerRef", payerRef },
            { "message", parsedResponse["message"] },
            { "alreadyExists", result == "501" }
        };
    }

    /// <summary>
    /// Create card reference in Card Storage API
    /// </summary>
    public static async Task<Dictionary<string, object>> CreateCardReference(
        Dictionary<string, string> config,
        Dictionary<string, object> cardData)
    {
        var merchantId = config["merchantId"];
        var sharedSecret = config["sharedSecret"];
        var environment = config.GetValueOrDefault("environment", "sandbox");

        var paymentMethodRef = (string)cardData["paymentMethodRef"];
        var payerRef = (string)cardData["payerRef"];
        var cardholderName = (string)cardData["cardholderName"];
        var cardDetails = cardData["cardDetails"] as Dictionary<string, string> ?? new Dictionary<string, string>();

        var timestamp = XmlApiUtils.GenerateTimestamp();
        var orderId = XmlApiUtils.GenerateOrderId("CARD");

        var sanitizedName = XmlApiUtils.SanitizeAlphanumeric(cardholderName, 100);

        // Generate hash for card-new
        var hashVal = XmlApiUtils.GenerateCardNewHash(timestamp, merchantId, orderId, payerRef, sanitizedName, cardDetails["number"], sharedSecret);

        // Build XML request
        var expDate = cardDetails["expmonth"] + cardDetails["expyear"];
        var cardType = cardDetails.GetValueOrDefault("type", "VISA");

        var request = new XElement("request",
            new XAttribute("type", "card-new"),
            new XAttribute("timestamp", timestamp),
            new XElement("merchantid", merchantId),
            new XElement("orderid", orderId),
            new XElement("card",
                new XElement("ref", paymentMethodRef),
                new XElement("payerref", payerRef),
                new XElement("chname", sanitizedName),
                new XElement("number", cardDetails["number"]),
                new XElement("expdate", expDate),
                new XElement("type", cardType)
            ),
            new XElement("sha1hash", hashVal)
        );

        // Send request
        var xmlRequest = request.ToString(SaveOptions.DisableFormatting);
        var endpoint = XmlApiUtils.GetXmlApiEndpoint(environment);

        Console.WriteLine($"📤 [Card] Sending XML request to: {endpoint}");

        var content = new StringContent(xmlRequest, Encoding.UTF8, "application/xml");
        var response = await httpClient.PostAsync(endpoint, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        var parsedResponse = XmlApiUtils.ParseXmlResponse(responseBody);
        Console.WriteLine($"📥 [Card] Parsed response: {string.Join(", ", parsedResponse.Select(kv => $"{kv.Key}={kv.Value}"))}");

        // Check result (00 = success, 520 = card already exists - both acceptable)
        var result = parsedResponse["result"];
        if (result != "00" && result != "520")
        {
            throw new Exception($"Card reference creation failed: {parsedResponse["message"]} (Code: {result})");
        }

        return new Dictionary<string, object>
        {
            { "success", true },
            { "paymentMethodRef", paymentMethodRef },
            { "payerRef", payerRef },
            { "message", parsedResponse["message"] },
            { "alreadyExists", result == "520" }
        };
    }

    /// <summary>
    /// Store payment method (card) for recurring use with initial payment
    /// </summary>
    public static async Task<Dictionary<string, object>> StorePaymentMethodWithInitialPayment(
        Dictionary<string, string> config,
        Dictionary<string, object> paymentData)
    {
        var merchantId = config["merchantId"];
        var sharedSecret = config["sharedSecret"];
        var account = config.GetValueOrDefault("account", "internet");
        var environment = config.GetValueOrDefault("environment", "sandbox");

        var paymentMethodRef = (string)paymentData["paymentMethodRef"];
        var payerRef = (string)paymentData["payerRef"];
        var amount = Convert.ToDecimal(paymentData["amount"]);
        var currency = paymentData.GetValueOrDefault("currency", "USD")?.ToString() ?? "USD";
        var billingData = paymentData.GetValueOrDefault("billingData", new Dictionary<string, string>()) as Dictionary<string, string>
                          ?? new Dictionary<string, string>();

        var timestamp = XmlApiUtils.GenerateTimestamp();
        var orderId = XmlApiUtils.GenerateOrderId("INIT");
        var amountInCents = XmlApiUtils.ConvertToCents(amount);

        // Generate hash for receipt-in
        var hashVal = XmlApiUtils.GenerateStoredCardPaymentHash(timestamp, merchantId, orderId, amountInCents, currency, payerRef, sharedSecret);

        // Build XML request
        var request = new XElement("request",
            new XAttribute("type", "receipt-in"),
            new XAttribute("timestamp", timestamp),
            new XElement("merchantid", merchantId),
            new XElement("account", account),
            new XElement("orderid", orderId),
            new XElement("amount",
                new XAttribute("currency", currency),
                amountInCents
            ),
            new XElement("payerref", payerRef),
            new XElement("paymentmethod", paymentMethodRef),
            new XElement("autosettle", new XAttribute("flag", "1")),
            new XElement("recurring",
                new XAttribute("type", "fixed"),
                new XAttribute("sequence", "first")
            ),
            new XElement("sha1hash", hashVal)
        );

        // Add billing information
        if (billingData.ContainsKey("billing_zip") && !string.IsNullOrEmpty(billingData["billing_zip"]))
        {
            var country = XmlApiUtils.ConvertCountryCodeToAlpha2(billingData.GetValueOrDefault("country", "US"));
            var tssInfo = new XElement("tssinfo",
                new XElement("address",
                    new XElement("code", XmlApiUtils.SanitizePostalCode(billingData["billing_zip"])),
                    new XElement("country", country)
                )
            );
            request.Add(tssInfo);
        }

        // Send request
        var xmlRequest = request.ToString(SaveOptions.DisableFormatting);
        var endpoint = XmlApiUtils.GetXmlApiEndpoint(environment);

        Console.WriteLine($"📤 [Initial Payment] Sending XML request to: {endpoint}");

        var content = new StringContent(xmlRequest, Encoding.UTF8, "application/xml");
        var response = await httpClient.PostAsync(endpoint, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        var parsedResponse = XmlApiUtils.ParseXmlResponse(responseBody);
        Console.WriteLine($"📥 [Initial Payment] Parsed response: {string.Join(", ", parsedResponse.Select(kv => $"{kv.Key}={kv.Value}"))}");

        // Check if payment was successful
        var result = parsedResponse["result"];
        if (result != "00")
        {
            throw new Exception($"Initial payment failed: {parsedResponse["message"]} (Code: {result})");
        }

        return new Dictionary<string, object>
        {
            { "success", true },
            { "transactionId", parsedResponse["pasref"] },
            { "orderId", parsedResponse["orderid"] },
            { "authCode", parsedResponse["authcode"] },
            { "payerRef", payerRef },
            { "paymentMethodRef", paymentMethodRef },
            { "amount", amount },
            { "currency", currency },
            { "message", "Initial payment successful - payment method stored for recurring use" },
            { "timestamp", parsedResponse["timestamp"] }
        };
    }

    /// <summary>
    /// Create recurring payment schedule using Payment Scheduler API
    /// </summary>
    public static async Task<Dictionary<string, object>> CreateRecurringSchedule(
        Dictionary<string, string> config,
        Dictionary<string, object> scheduleData)
    {
        var merchantId = config["merchantId"];
        var sharedSecret = config["sharedSecret"];
        var account = config.GetValueOrDefault("account", "internet");
        var environment = config.GetValueOrDefault("environment", "sandbox");

        var scheduleRef = (string)scheduleData["scheduleRef"];
        var payerRef = (string)scheduleData["payerRef"];
        var paymentMethodRef = (string)scheduleData["paymentMethodRef"];
        var amount = Convert.ToDecimal(scheduleData["amount"]);
        var currency = scheduleData.GetValueOrDefault("currency", "USD")?.ToString() ?? "USD";
        var frequency = (string)scheduleData["frequency"];
        var startDate = scheduleData.GetValueOrDefault("startDate", "")?.ToString() ?? "";
        var numTimes = scheduleData.ContainsKey("numTimes") ? Convert.ToInt32(scheduleData["numTimes"]) : -1;

        var timestamp = XmlApiUtils.GenerateTimestamp();
        var amountInCents = XmlApiUtils.ConvertToCents(amount);
        var schedule = XmlApiUtils.MapFrequencyToSchedule(frequency);

        // Generate hash for schedule-new
        var hashVal = XmlApiUtils.GenerateScheduleHash(timestamp, merchantId, scheduleRef, amountInCents, currency, payerRef, schedule, sharedSecret);

        // Build XML request
        var request = new XElement("request",
            new XAttribute("type", "schedule-new"),
            new XAttribute("timestamp", timestamp),
            new XElement("merchantid", merchantId),
            new XElement("account", account),
            new XElement("scheduleref", scheduleRef),
            new XElement("transtype", "auth"),
            new XElement("schedule", schedule),
            new XElement("numtimes", numTimes),
            new XElement("payerref", payerRef),
            new XElement("paymentmethod", paymentMethodRef),
            new XElement("amount",
                new XAttribute("currency", currency),
                amountInCents
            ),
            new XElement("sha1hash", hashVal)
        );

        // Send request
        var xmlRequest = request.ToString(SaveOptions.DisableFormatting);
        var endpoint = XmlApiUtils.GetXmlApiEndpoint(environment);

        Console.WriteLine($"📤 [Schedule] Sending XML request to: {endpoint}");
        Console.WriteLine($"📤 [Schedule] Request XML: {xmlRequest}");

        var content = new StringContent(xmlRequest, Encoding.UTF8, "application/xml");
        var response = await httpClient.PostAsync(endpoint, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        var parsedResponse = XmlApiUtils.ParseXmlResponse(responseBody);
        Console.WriteLine($"📥 [Schedule] Parsed response: {string.Join(", ", parsedResponse.Select(kv => $"{kv.Key}={kv.Value}"))}");

        // Check if schedule was created successfully
        var result = parsedResponse["result"];
        if (result != "00")
        {
            throw new Exception($"Schedule creation failed: {parsedResponse["message"]} (Code: {result})");
        }

        return new Dictionary<string, object>
        {
            { "success", true },
            { "scheduleRef", scheduleRef },
            { "scheduleText", parsedResponse.GetValueOrDefault("scheduletext", "") },
            { "message", parsedResponse["message"] },
            { "frequency", frequency },
            { "startDate", startDate },
            { "amount", amount },
            { "currency", currency },
            { "numTimes", numTimes }
        };
    }

    /// <summary>
    /// Process complete recurring payment setup
    /// </summary>
    public static async Task<Dictionary<string, object>> ProcessRecurringPaymentSetup(
        Dictionary<string, string> config,
        Dictionary<string, object> data)
    {
        var cardDetails = data["cardDetails"] as Dictionary<string, string> ?? new Dictionary<string, string>();
        var amount = Convert.ToDecimal(data["amount"]);
        var currency = data.GetValueOrDefault("currency", "USD")?.ToString() ?? "USD";
        var frequency = (string)data["frequency"];
        var startDate = (string)data["startDate"];
        var customerData = data["customerData"] as Dictionary<string, string> ?? new Dictionary<string, string>();
        var billingData = data.GetValueOrDefault("billingData", new Dictionary<string, string>()) as Dictionary<string, string>
                          ?? new Dictionary<string, string>();

        // Normalize card expiry format
        var normalizedCardDetails = XmlApiUtils.NormalizeCardExpiry(cardDetails);

        // Generate unique references
        var timestampMs = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var timestampStr = timestampMs.ToString();
        var payerRef = "CUS" + timestampStr[^10..];
        var paymentMethodRef = "PMT" + timestampStr[^10..];
        var scheduleRef = timestampStr[^13..];

        // Step 1: Create or update customer
        Console.WriteLine("Step 1: Creating customer...");
        var customerParams = new Dictionary<string, object>
        {
            { "payerRef", payerRef },
            { "firstName", customerData.GetValueOrDefault("first_name", "") },
            { "lastName", customerData.GetValueOrDefault("last_name", "") },
            { "email", customerData.GetValueOrDefault("email", "") },
            { "phone", customerData.GetValueOrDefault("phone", "") },
            { "address", new Dictionary<string, string>
                {
                    { "street_address", customerData.GetValueOrDefault("street_address", "") ?? billingData.GetValueOrDefault("street_address", "") },
                    { "city", customerData.GetValueOrDefault("city", "") ?? billingData.GetValueOrDefault("city", "") },
                    { "state", customerData.GetValueOrDefault("state", "") ?? billingData.GetValueOrDefault("state", "") },
                    { "billing_zip", customerData.GetValueOrDefault("billing_zip", "") ?? billingData.GetValueOrDefault("billing_zip", "") },
                    { "country", customerData.GetValueOrDefault("country", "") ?? billingData.GetValueOrDefault("country", "US") }
                }
            }
        };

        var customerResult = await CreateOrUpdateCustomer(config, customerParams);

        // Step 2: Create card reference
        Console.WriteLine("Step 2: Creating card reference...");
        var cardParams = new Dictionary<string, object>
        {
            { "paymentMethodRef", paymentMethodRef },
            { "payerRef", payerRef },
            { "cardholderName", $"{customerData.GetValueOrDefault("first_name", "")} {customerData.GetValueOrDefault("last_name", "")}" },
            { "cardDetails", normalizedCardDetails }
        };

        var cardResult = await CreateCardReference(config, cardParams);

        // Step 3: Process initial payment
        Console.WriteLine("Step 3: Processing initial payment...");
        var paymentParams = new Dictionary<string, object>
        {
            { "paymentMethodRef", paymentMethodRef },
            { "payerRef", payerRef },
            { "amount", amount },
            { "currency", currency },
            { "billingData", billingData },
            { "customerData", customerData }
        };

        var initialPaymentResult = await StorePaymentMethodWithInitialPayment(config, paymentParams);

        // Step 4: Create recurring schedule
        Console.WriteLine("Step 4: Creating recurring schedule...");
        var scheduleParams = new Dictionary<string, object>
        {
            { "scheduleRef", scheduleRef },
            { "payerRef", payerRef },
            { "paymentMethodRef", paymentMethodRef },
            { "amount", amount },
            { "currency", currency },
            { "frequency", frequency },
            { "startDate", startDate }
        };

        var scheduleResult = await CreateRecurringSchedule(config, scheduleParams);

        // Return complete result
        return new Dictionary<string, object>
        {
            { "success", true },
            { "message", "Recurring payment setup completed successfully" },
            { "customer", new Dictionary<string, object>
                {
                    { "payerRef", customerResult["payerRef"] },
                    { "name", $"{customerData.GetValueOrDefault("first_name", "")} {customerData.GetValueOrDefault("last_name", "")}" },
                    { "email", customerData.GetValueOrDefault("email", "") }
                }
            },
            { "payment", new Dictionary<string, object>
                {
                    { "transactionId", initialPaymentResult["transactionId"] },
                    { "orderId", initialPaymentResult["orderId"] },
                    { "authCode", initialPaymentResult["authCode"] },
                    { "amount", initialPaymentResult["amount"] },
                    { "currency", initialPaymentResult["currency"] }
                }
            },
            { "schedule", new Dictionary<string, object>
                {
                    { "scheduleRef", scheduleResult["scheduleRef"] },
                    { "scheduleText", scheduleResult["scheduleText"] },
                    { "frequency", scheduleResult["frequency"] },
                    { "startDate", scheduleResult["startDate"] },
                    { "amount", scheduleResult["amount"] },
                    { "currency", scheduleResult["currency"] }
                }
            },
            { "paymentMethodRef", paymentMethodRef },
            { "timestamp", DateTime.Now.ToString("o") }
        };
    }
}

/// <summary>
/// Extension methods for dictionary helpers
/// </summary>
public static class DictionaryExtensions
{
    public static TValue? GetValueOrDefault<TKey, TValue>(this Dictionary<TKey, TValue> dictionary, TKey key, TValue? defaultValue = default) where TKey : notnull
    {
        return dictionary.TryGetValue(key, out var value) ? value : defaultValue;
    }
}
