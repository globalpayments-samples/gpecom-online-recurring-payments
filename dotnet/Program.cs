using GlobalPayments.Api;
using GlobalPayments.Api.Entities;
using GlobalPayments.Api.PaymentMethods;
using dotenv.net;

namespace CardPaymentSample;

/// <summary>
/// Card Payment Processing Application
/// 
/// This application demonstrates card payment processing using the Global Payments SDK.
/// It provides endpoints for configuration and payment processing, handling tokenized
/// card data to ensure secure payment processing.
/// </summary>
public class Program
{
    public static void Main(string[] args)
    {
        // Load environment variables from .env file
        DotEnv.Load();

        var builder = WebApplication.CreateBuilder(args);
        
        var app = builder.Build();

        // Configure static file serving for the payment form
        app.UseDefaultFiles();
        app.UseStaticFiles();
        
        // Configure the SDK on startup
        ConfigureGlobalPaymentsSDK();

        ConfigureHPPRequestEndpoint(app);
        ConfigureHPPResponseEndpoint(app);
        ConfigureRecurringEndpoint(app);

        var port = System.Environment.GetEnvironmentVariable("PORT") ?? "8000";
        var merchantId = System.Environment.GetEnvironmentVariable("MERCHANT_ID") ?? "[not configured]";
        var environment = System.Environment.GetEnvironmentVariable("ENVIRONMENT") ?? "sandbox";

        app.Urls.Add($"http://0.0.0.0:{port}");

        // Display startup information
        app.Lifetime.ApplicationStarted.Register(() =>
        {
            Console.WriteLine("============================================================");
            Console.WriteLine("Global Payments XML API - Recurring Payments Server");
            Console.WriteLine("============================================================");
            Console.WriteLine($"Server running at: http://localhost:{port}");
            Console.WriteLine($"Environment: {environment}");
            Console.WriteLine($"Merchant ID: {merchantId}");
            Console.WriteLine("");
            Console.WriteLine("Available endpoints:");
            Console.WriteLine("  GET  /health           - Health check");
            Console.WriteLine("  GET  /config           - Get configuration");
            Console.WriteLine("  POST /process-payment  - Process payment or setup recurring");
            Console.WriteLine("");
            Console.WriteLine("Features:");
            Console.WriteLine("  ✓ One-time payments");
            Console.WriteLine("  ✓ Recurring/subscription payments");
            Console.WriteLine("  ✓ Customer and payment method storage");
            Console.WriteLine("  ✓ Payment Scheduler integration");
            Console.WriteLine("  ✓ StoredCredential for recurring transactions");
            Console.WriteLine("  ✓ Multiple frequencies: weekly, bi-weekly, monthly, quarterly, yearly");
            Console.WriteLine("============================================================");
            Console.WriteLine("");
        });

        app.Run();
    }

    /// <summary>
    /// Configures the Global Payments SDK with necessary credentials and settings.
    /// For XML API recurring payments, configuration is handled per-request.
    /// This method is kept for potential future SDK-based operations.
    /// </summary>
    private static void ConfigureGlobalPaymentsSDK()
    {
        // XML API uses direct HTTP requests with per-request configuration
        // No global SDK configuration needed for recurring payments
    }


    /// <summary>
    /// Configures the HPP request endpoint that generates HPP request JSON.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigureHPPRequestEndpoint(WebApplication app)
    {
        app.MapPost("/hpp-request", async (HttpContext context) =>
        {
            try
            {
                // Read and parse JSON request body
                using var reader = new StreamReader(context.Request.Body);
                var body = await reader.ReadToEndAsync();
                var jsonRequest = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(body);

                if (jsonRequest == null)
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Invalid request body",
                        error_code = "INVALID_REQUEST"
                    });
                }

                // Validate required fields
                if (!jsonRequest.ContainsKey("amount"))
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Amount is required",
                        error_code = "INVALID_AMOUNT"
                    });
                }

                var amount = jsonRequest["amount"].GetDecimal();
                if (amount <= 0)
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Valid amount is required",
                        error_code = "INVALID_AMOUNT"
                    });
                }

                // Get configuration
                var merchantId = System.Environment.GetEnvironmentVariable("MERCHANT_ID") ?? "";
                var sharedSecret = System.Environment.GetEnvironmentVariable("SHARED_SECRET") ?? "";
                var account = System.Environment.GetEnvironmentVariable("ACCOUNT") ?? "internet";

                if (string.IsNullOrEmpty(merchantId) || string.IsNullOrEmpty(sharedSecret))
                {
                    return Results.Json(new {
                        success = false,
                        message = "Server configuration error",
                        error_code = "CONFIG_ERROR"
                    }, statusCode: 500);
                }

                // Get optional parameters
                var currency = jsonRequest.ContainsKey("currency") ? jsonRequest["currency"].GetString() ?? "USD" : "USD";

                // Generate request parameters
                var timestamp = XmlApiUtils.GenerateTimestamp();
                var orderId = XmlApiUtils.GenerateOrderId("HPP");
                var amountInCents = XmlApiUtils.ConvertToCents(amount);

                // Generate hash
                var hash = XmlApiUtils.GenerateHPPHash(timestamp, merchantId, orderId, amountInCents, currency, sharedSecret);

                // Build HPP request JSON
                var hppRequest = new Dictionary<string, string>
                {
                    { "TIMESTAMP", timestamp },
                    { "MERCHANT_ID", merchantId },
                    { "ACCOUNT", account },
                    { "ORDER_ID", orderId },
                    { "AMOUNT", amountInCents.ToString() },
                    { "CURRENCY", currency },
                    { "AUTO_SETTLE_FLAG", "1" },
                    { "HPP_VERSION", "2" },
                    { "HPP_CHANNEL", "ECOM" },
                    { "MERCHANT_RESPONSE_URL", $"{context.Request.Scheme}://{context.Request.Host}/hpp-response" },
                    { "SHA1HASH", hash }
                };

                // Add optional customer fields
                if (jsonRequest.ContainsKey("customer_email"))
                    hppRequest["HPP_CUSTOMER_EMAIL"] = jsonRequest["customer_email"].GetString() ?? "";
                if (jsonRequest.ContainsKey("customer_phone"))
                    hppRequest["HPP_CUSTOMER_PHONENUMBER_MOBILE"] = jsonRequest["customer_phone"].GetString() ?? "";

                // Add billing address fields
                if (jsonRequest.ContainsKey("billing_street1"))
                    hppRequest["HPP_BILLING_STREET1"] = jsonRequest["billing_street1"].GetString() ?? "";
                if (jsonRequest.ContainsKey("billing_street2"))
                    hppRequest["HPP_BILLING_STREET2"] = jsonRequest["billing_street2"].GetString() ?? "";
                if (jsonRequest.ContainsKey("billing_street3"))
                    hppRequest["HPP_BILLING_STREET3"] = jsonRequest["billing_street3"].GetString() ?? "";
                if (jsonRequest.ContainsKey("billing_city"))
                    hppRequest["HPP_BILLING_CITY"] = jsonRequest["billing_city"].GetString() ?? "";
                if (jsonRequest.ContainsKey("billing_postalcode"))
                    hppRequest["HPP_BILLING_POSTALCODE"] = jsonRequest["billing_postalcode"].GetString() ?? "";
                if (jsonRequest.ContainsKey("billing_country"))
                    hppRequest["HPP_BILLING_COUNTRY"] = jsonRequest["billing_country"].GetString() ?? "";

                // Add shipping address fields
                if (jsonRequest.ContainsKey("shipping_street1"))
                    hppRequest["HPP_SHIPPING_STREET1"] = jsonRequest["shipping_street1"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_street2"))
                    hppRequest["HPP_SHIPPING_STREET2"] = jsonRequest["shipping_street2"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_street3"))
                    hppRequest["HPP_SHIPPING_STREET3"] = jsonRequest["shipping_street3"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_city"))
                    hppRequest["HPP_SHIPPING_CITY"] = jsonRequest["shipping_city"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_state"))
                    hppRequest["HPP_SHIPPING_STATE"] = jsonRequest["shipping_state"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_postalcode"))
                    hppRequest["HPP_SHIPPING_POSTALCODE"] = jsonRequest["shipping_postalcode"].GetString() ?? "";
                if (jsonRequest.ContainsKey("shipping_country"))
                    hppRequest["HPP_SHIPPING_COUNTRY"] = jsonRequest["shipping_country"].GetString() ?? "";

                // Send success response
                return Results.Ok(new {
                    success = true,
                    data = hppRequest,
                    message = "HPP request generated successfully",
                    timestamp = DateTime.UtcNow.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new {
                    success = false,
                    message = $"Error generating HPP request: {ex.Message}",
                    error_code = "HPP_ERROR"
                }, statusCode: 500);
            }
        });
    }

    /// <summary>
    /// Configures the HPP response endpoint that handles HPP callbacks.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigureHPPResponseEndpoint(WebApplication app)
    {
        app.MapPost("/hpp-response", async (HttpContext context) =>
        {
            try
            {
                // Get configuration
                var merchantId = System.Environment.GetEnvironmentVariable("MERCHANT_ID") ?? "";
                var sharedSecret = System.Environment.GetEnvironmentVariable("SHARED_SECRET") ?? "";

                // Extract response parameters from form data
                var form = await context.Request.ReadFormAsync();
                
                var timestamp = form["TIMESTAMP"].ToString();
                var responseMerchantId = form["MERCHANT_ID"].ToString();
                var orderId = form["ORDER_ID"].ToString();
                var result = form["RESULT"].ToString();
                var message = form["MESSAGE"].ToString();
                var pasref = form["PASREF"].ToString();
                var authcode = form["AUTHCODE"].ToString();
                var sha1hash = form["SHA1HASH"].ToString();
                var amount = form["AMOUNT"].ToString();
                var currency = form["CURRENCY"].ToString();

                // Generate expected hash
                var expectedHash = XmlApiUtils.GenerateHPPResponseHash(timestamp, responseMerchantId, orderId, result, message, pasref, authcode, sharedSecret);

                // Verify hash
                if (!expectedHash.Equals(sha1hash, StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.ContentType = "text/html";
                    await context.Response.WriteAsync(RenderErrorPage("Payment Verification Failed", "The payment response could not be verified. Please contact support."));
                    return;
                }

                // Check result code
                var success = result == "00";

                context.Response.ContentType = "text/html";
                if (success)
                {
                    await context.Response.WriteAsync(RenderSuccessPage(orderId, amount, currency, message, pasref, authcode));
                }
                else
                {
                    await context.Response.WriteAsync(RenderErrorPage("Payment Failed", $"Payment failed: {message} (Code: {result})"));
                }
            }
            catch (Exception ex)
            {
                context.Response.ContentType = "text/html";
                await context.Response.WriteAsync(RenderErrorPage("Error Processing Response", $"An error occurred while processing the payment response: {ex.Message}"));
            }
        });
    }

    private static string RenderSuccessPage(string orderId, string amount, string currency, string message, string pasref, string authcode)
    {
        var amountDisplay = "";
        if (!string.IsNullOrEmpty(amount) && int.TryParse(amount, out var amountInCents))
        {
            var amountInDollars = amountInCents / 100.0;
            amountDisplay = $"<p><strong>Amount:</strong> {amountInDollars:F2} {EscapeHtml(currency)}</p>";
        }

        var authcodeDisplay = !string.IsNullOrEmpty(authcode) ? $"<p><strong>Auth Code:</strong> {EscapeHtml(authcode)}</p>" : "";

        return $@"<!DOCTYPE html>
<html>
<head>
    <title>Payment Successful</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }}
        .success {{ color: #28a745; }}
        .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }}
        .details p {{ margin: 5px 0; }}
        button {{ margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }}
        button:hover {{ background-color: #0056b3; }}
    </style>
</head>
<body>
    <h1 class=""success"">✓ Payment Successful</h1>
    <p>Your payment has been processed successfully.</p>
    <div class=""details"">
        <h3>Transaction Details</h3>
        <p><strong>Order ID:</strong> {EscapeHtml(orderId)}</p>
        {amountDisplay}
        <p><strong>Status:</strong> {EscapeHtml(message)}</p>
        <p><strong>Reference:</strong> {EscapeHtml(pasref)}</p>
        {authcodeDisplay}
    </div>
    <button onclick=""window.close()"">Close Window</button>
</body>
</html>";
    }

    private static string RenderErrorPage(string title, string errorMessage)
    {
        return $@"<!DOCTYPE html>
<html>
<head>
    <title>{EscapeHtml(title)}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }}
        .error {{ color: #dc3545; }}
        button {{ margin-top: 20px; padding: 10px 20px; background-color: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; }}
        button:hover {{ background-color: #5a6268; }}
    </style>
</head>
<body>
    <h1 class=""error"">✗ {EscapeHtml(title)}</h1>
    <p>{EscapeHtml(errorMessage)}</p>
    <button onclick=""window.close()"">Close Window</button>
</body>
</html>";
    }

    private static string EscapeHtml(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        return text.Replace("&", "&amp;")
                   .Replace("<", "&lt;")
                   .Replace(">", "&gt;")
                   .Replace("\"", "&quot;")
                   .Replace("'", "&#x27;");
    }

    /// <summary>
    /// Configures the recurring payment setup endpoint that handles XML API recurring payments.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigureRecurringEndpoint(WebApplication app)
    {
        app.MapPost("/recurring-setup", async (HttpContext context) =>
        {
            try
            {
                // Read and parse JSON request body
                using var reader = new StreamReader(context.Request.Body);
                var body = await reader.ReadToEndAsync();
                var jsonRequest = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(body);

                if (jsonRequest == null)
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Invalid request body",
                        error = new {
                            code = "INVALID_REQUEST",
                            details = "Request body must be valid JSON"
                        }
                    });
                }

                // Validate required card fields
                if (!jsonRequest.ContainsKey("card_number") || !jsonRequest.ContainsKey("card_expiry") || !jsonRequest.ContainsKey("card_cvv"))
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Card information required",
                        error = new {
                            code = "MISSING_CARD_INFO",
                            details = "Card number, expiry, and CVV are required"
                        }
                    });
                }

                // Validate required recurring fields
                if (!jsonRequest.ContainsKey("amount") || !jsonRequest.ContainsKey("frequency") || !jsonRequest.ContainsKey("start_date"))
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Recurring payment details required",
                        error = new {
                            code = "MISSING_RECURRING_INFO",
                            details = "Amount, frequency, and start date are required"
                        }
                    });
                }

                // Validate required customer fields
                if (!jsonRequest.ContainsKey("first_name") || !jsonRequest.ContainsKey("last_name") || !jsonRequest.ContainsKey("email"))
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Customer information required",
                        error = new {
                            code = "MISSING_CUSTOMER_INFO",
                            details = "First name, last name, and email are required"
                        }
                    });
                }

                // Parse card expiry (MM/YY format)
                var cardExpiry = jsonRequest["card_expiry"].GetString() ?? "";
                var expiryParts = cardExpiry.Split('/');
                if (expiryParts.Length != 2)
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Invalid card expiry format. Expected MM/YY",
                        error = new {
                            code = "INVALID_EXPIRY",
                            details = "Card expiry must be in MM/YY format"
                        }
                    });
                }

                var expMonth = expiryParts[0].Trim();
                var expYear = expiryParts[1].Trim();

                // Ensure month is 2 digits
                if (expMonth.Length == 1)
                    expMonth = "0" + expMonth;

                // Prepare card details
                var cardDetails = new Dictionary<string, string>
                {
                    { "number", (jsonRequest["card_number"].GetString() ?? "").Replace(" ", "") },
                    { "expmonth", expMonth },
                    { "expyear", expYear },
                    { "cvn", jsonRequest["card_cvv"].GetString() ?? "" }
                };

                // Get card name or construct from customer name
                var cardName = jsonRequest.ContainsKey("card_name") && jsonRequest["card_name"].ValueKind != System.Text.Json.JsonValueKind.Null
                    ? jsonRequest["card_name"].GetString()
                    : $"{jsonRequest["first_name"].GetString()} {jsonRequest["last_name"].GetString()}";
                cardDetails["chname"] = cardName ?? "";

                // Prepare customer data
                var customerData = new Dictionary<string, string>
                {
                    { "first_name", jsonRequest["first_name"].GetString() ?? "" },
                    { "last_name", jsonRequest["last_name"].GetString() ?? "" },
                    { "email", jsonRequest["email"].GetString() ?? "" },
                    { "phone", jsonRequest.ContainsKey("phone") ? jsonRequest["phone"].GetString() ?? "" : "" },
                    { "street_address", jsonRequest.ContainsKey("street_address") ? jsonRequest["street_address"].GetString() ?? "" : "" },
                    { "city", jsonRequest.ContainsKey("city") ? jsonRequest["city"].GetString() ?? "" : "" },
                    { "state", jsonRequest.ContainsKey("state") ? jsonRequest["state"].GetString() ?? "" : "" },
                    { "billing_zip", jsonRequest.ContainsKey("billing_zip") ? jsonRequest["billing_zip"].GetString() ?? "" : "" },
                    { "country", jsonRequest.ContainsKey("billing_country") ? jsonRequest["billing_country"].GetString() ?? "" : "" }
                };

                // Prepare billing data
                var billingData = new Dictionary<string, string>
                {
                    { "billing_zip", jsonRequest.ContainsKey("billing_zip") ? jsonRequest["billing_zip"].GetString() ?? "" : "" },
                    { "country", jsonRequest.ContainsKey("billing_country") ? jsonRequest["billing_country"].GetString() ?? "" : "" },
                    { "street_address", jsonRequest.ContainsKey("street_address") ? jsonRequest["street_address"].GetString() ?? "" : "" },
                    { "city", jsonRequest.ContainsKey("city") ? jsonRequest["city"].GetString() ?? "" : "" },
                    { "state", jsonRequest.ContainsKey("state") ? jsonRequest["state"].GetString() ?? "" : "" }
                };

                // Set currency default
                var currency = jsonRequest.ContainsKey("currency") ? jsonRequest["currency"].GetString() ?? "USD" : "USD";

                // Prepare configuration
                var config = new Dictionary<string, string>
                {
                    { "merchantId", System.Environment.GetEnvironmentVariable("MERCHANT_ID") ?? "" },
                    { "sharedSecret", System.Environment.GetEnvironmentVariable("SHARED_SECRET") ?? "" },
                    { "account", System.Environment.GetEnvironmentVariable("ACCOUNT") ?? "internet" },
                    { "environment", System.Environment.GetEnvironmentVariable("ENVIRONMENT") ?? "sandbox" }
                };

                // Prepare payment data
                var paymentData = new Dictionary<string, object>
                {
                    { "cardDetails", cardDetails },
                    { "amount", jsonRequest["amount"].GetDecimal() },
                    { "currency", currency },
                    { "frequency", jsonRequest["frequency"].GetString() ?? "" },
                    { "startDate", jsonRequest["start_date"].GetString() ?? "" },
                    { "customerData", customerData },
                    { "billingData", billingData }
                };

                // Process recurring payment setup
                var result = await PaymentUtils.ProcessRecurringPaymentSetup(config, paymentData);

                // Send success response
                return Results.Ok(new {
                    success = true,
                    message = "Recurring payment setup completed successfully",
                    data = result
                });
            }
            catch (Exception ex)
            {
                // Send error response
                return Results.Json(new {
                    success = false,
                    message = ex.Message,
                    error = new {
                        code = "PROCESSING_ERROR",
                        details = ex.Message
                    }
                }, statusCode: 500);
            }
        });
    }
}
