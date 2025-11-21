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

        ConfigureEndpoints(app);
        ConfigureRecurringEndpoint(app);

        var port = System.Environment.GetEnvironmentVariable("PORT") ?? "8000";
        app.Urls.Add($"http://0.0.0.0:{port}");

        app.Run();
    }

    /// <summary>
    /// Configures the Global Payments SDK with necessary credentials and settings.
    /// This must be called before processing any payments.
    /// </summary>
    private static void ConfigureGlobalPaymentsSDK()
    {
        ServicesContainer.ConfigureService(new PorticoConfig
        {
            SecretApiKey = System.Environment.GetEnvironmentVariable("SECRET_API_KEY"),
            DeveloperId = "000000",
            VersionNumber = "0000",
            ServiceUrl = "https://cert.api2.heartlandportico.com"
        });
    }

    /// <summary>
    /// Configures the application's HTTP endpoints for payment processing.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigureEndpoints(WebApplication app)
    {
        // Configure HTTP endpoints
        app.MapGet("/config", () => Results.Ok(new
        { 
            success = true,
            data = new {
                publicApiKey = System.Environment.GetEnvironmentVariable("PUBLIC_API_KEY")
            }
        }));

        ConfigurePaymentEndpoint(app);
    }

    /// <summary>
    /// Sanitizes postal code input by removing invalid characters.
    /// </summary>
    /// <param name="postalCode">The postal code to sanitize. Can be null.</param>
    /// <returns>
    /// A sanitized postal code containing only alphanumeric characters and hyphens,
    /// limited to 10 characters. Returns empty string if input is null or empty.
    /// </returns>
    private static string SanitizePostalCode(string postalCode)
    {
        if (string.IsNullOrEmpty(postalCode)) return string.Empty;
        
        // Remove any characters that aren't alphanumeric or hyphen
        var sanitized = new string(postalCode.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());
        
        // Limit length to 10 characters
        return sanitized.Length > 10 ? sanitized[..10] : sanitized;
    }

    /// <summary>
    /// Configures the payment processing endpoint that handles card transactions.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigurePaymentEndpoint(WebApplication app)
    {
        app.MapPost("/process-payment", async (HttpContext context) =>
        {
            // Parse form data from the request
            var form = await context.Request.ReadFormAsync();
            var billingZip = form["billing_zip"].ToString();
            var token = form["payment_token"].ToString();
            var amountStr = form["amount"].ToString();

            // Validate required fields are present
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(billingZip) || string.IsNullOrEmpty(amountStr))
            {
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "VALIDATION_ERROR",
                        details = "Missing required fields"
                    }
                });
            }

            // Validate and parse amount
            if (!decimal.TryParse(amountStr, out var amount) || amount <= 0)
            {
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "VALIDATION_ERROR",
                        details = "Amount must be a positive number"
                    }
                });
            }

            // Initialize payment data using tokenized card information
            var card = new CreditCardData
            {
                Token = token
            };

            // Create billing address for AVS verification
            var address = new Address
            {
                PostalCode = SanitizePostalCode(billingZip)
            };

            try
            {
                // Process the payment transaction using the provided amount
                var response = card.Charge(amount)
                    .WithAllowDuplicates(true)
                    .WithCurrency("USD")
                    .WithAddress(address)
                    .Execute();

                // Verify transaction was successful
                if (response.ResponseCode != "00")
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Payment processing failed",
                        error = new {
                            code = "PAYMENT_DECLINED",
                            details = response.ResponseMessage
                        }
                    });
                }

                // Return success response with transaction ID
                return Results.Ok(new
                {
                    success = true,
                    message = $"Payment successful! Transaction ID: {response.TransactionId}",
                    data = new {
                        transactionId = response.TransactionId
                    }
                });
            } 
            catch (ApiException ex)
            {
                // Handle payment processing errors
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "API_ERROR",
                        details = ex.Message
                    }
                });
            }
        });
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
                // Log the error
                Console.WriteLine($"Error processing recurring setup: {ex.Message}");
                Console.WriteLine(ex.StackTrace);

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
