using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace CardPaymentSample;

/// <summary>
/// Global Payments XML API Utilities
///
/// Provides utility functions for XML API integration including:
/// - SHA-1 hash generation for request authentication
/// - Timestamp formatting
/// - XML request building
/// - XML response parsing
/// - Country code conversion
/// </summary>
public static class XmlApiUtils
{
    private static readonly Dictionary<string, string> CountryCodeMap = new()
    {
        { "036", "AU" }, // Australia
        { "124", "CA" }, // Canada
        { "276", "DE" }, // Germany
        { "372", "IE" }, // Ireland
        { "826", "GB" }, // United Kingdom
        { "840", "US" }, // United States
        { "250", "FR" }, // France
        { "380", "IT" }, // Italy
        { "724", "ES" }, // Spain
        { "528", "NL" }, // Netherlands
        { "056", "BE" }, // Belgium
        { "208", "DK" }, // Denmark
        { "246", "FI" }, // Finland
        { "578", "NO" }, // Norway
        { "752", "SE" }, // Sweden
        { "756", "CH" }, // Switzerland
        { "040", "AT" }, // Austria
        { "620", "PT" }, // Portugal
        { "616", "PL" }, // Poland
        { "203", "CZ" }  // Czech Republic
    };

    private static readonly Dictionary<string, string> FrequencyMap = new()
    {
        { "weekly", "weekly" },
        { "bi-weekly", "biweekly" },
        { "biweekly", "biweekly" },
        { "monthly", "monthly" },
        { "quarterly", "quarterly" },
        { "yearly", "yearly" },
        { "annually", "yearly" }
    };

    /// <summary>
    /// Generate timestamp in XML API format: YYYYMMDDHHMMSS
    /// </summary>
    public static string GenerateTimestamp()
    {
        return DateTime.Now.ToString("yyyyMMddHHmmss");
    }

    /// <summary>
    /// Generate unique order ID
    /// </summary>
    public static string GenerateOrderId(string prefix = "ORD")
    {
        var timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var randomNum = new Random().Next(1000);
        return $"{prefix}_{timestamp}_{randomNum}";
    }

    /// <summary>
    /// Generate SHA-1 hash for XML API authentication
    ///
    /// XML API uses a two-step hashing process:
    /// 1. Hash the concatenated request values
    /// 2. Hash the result with the shared secret appended
    /// </summary>
    public static string GenerateSha1Hash(string dataString, string sharedSecret)
    {
        using var sha1 = SHA1.Create();

        // First hash
        var firstHashBytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(dataString));
        var firstHash = BitConverter.ToString(firstHashBytes).Replace("-", "").ToLower();

        // Second hash with shared secret
        var secondString = $"{firstHash}.{sharedSecret}";
        var secondHashBytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(secondString));
        var finalHash = BitConverter.ToString(secondHashBytes).Replace("-", "").ToLower();

        return finalHash;
    }

    /// <summary>
    /// Generate hash for payer-new request
    /// </summary>
    public static string GeneratePayerNewHash(string timestamp, string merchantId, string orderId, string payerRef, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{orderId}...{payerRef}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Generate hash for card-new request
    /// </summary>
    public static string GenerateCardNewHash(string timestamp, string merchantId, string orderId, string payerRef, string chname, string cardNumber, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{orderId}...{payerRef}.{chname}.{cardNumber}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Generate hash for receipt-in (stored card payment) request
    /// </summary>
    public static string GenerateStoredCardPaymentHash(string timestamp, string merchantId, string orderId, int amount, string currency, string payerRef, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{orderId}.{amount}.{currency}.{payerRef}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Generate hash for schedule-new request
    /// </summary>
    public static string GenerateScheduleHash(string timestamp, string merchantId, string scheduleRef, int amount, string currency, string payerRef, string schedule, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{scheduleRef}.{amount}.{currency}.{payerRef}.{schedule}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Generate hash for Hosted Payment Page (HPP) requests
    /// Hash blueprint: timestamp.merchantid.orderid.amount.currency
    /// </summary>
    public static string GenerateHPPHash(string timestamp, string merchantId, string orderId, int amount, string currency, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{orderId}.{amount}.{currency}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Generate hash for HPP response verification
    /// Hash blueprint: timestamp.merchantid.orderid.result.message.pasref.authcode
    /// </summary>
    public static string GenerateHPPResponseHash(string timestamp, string merchantId, string orderId, string result, string message, string pasref, string authcode, string sharedSecret)
    {
        var dataString = $"{timestamp}.{merchantId}.{orderId}.{result}.{message}.{pasref}.{authcode}";
        return GenerateSha1Hash(dataString, sharedSecret);
    }

    /// <summary>
    /// Convert dollar amount to cents
    /// </summary>
    public static int ConvertToCents(decimal amount)
    {
        return (int)Math.Round(amount * 100);
    }

    /// <summary>
    /// Convert cents to dollars
    /// </summary>
    public static decimal ConvertFromCents(int cents)
    {
        return cents / 100.0m;
    }

    /// <summary>
    /// Sanitize postal code
    /// </summary>
    public static string SanitizePostalCode(string postalCode)
    {
        if (string.IsNullOrEmpty(postalCode))
            return string.Empty;

        var sanitized = postalCode.Replace(" ", "").Replace("-", "");
        return sanitized.Length > 16 ? sanitized[..16] : sanitized;
    }

    /// <summary>
    /// Sanitize alphanumeric string
    /// </summary>
    public static string SanitizeAlphanumeric(string value, int maxLength = 255)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        // Remove any potentially problematic characters
        var sanitized = Regex.Replace(value, @"[^a-zA-Z0-9 .,@_-]", "");
        return sanitized.Length > maxLength ? sanitized[..maxLength] : sanitized;
    }

    /// <summary>
    /// Map frequency to schedule format
    /// </summary>
    public static string MapFrequencyToSchedule(string frequency)
    {
        return FrequencyMap.TryGetValue(frequency.ToLower(), out var schedule) ? schedule : "monthly";
    }

    /// <summary>
    /// Get XML API endpoint based on environment
    /// </summary>
    public static string GetXmlApiEndpoint(string environment = "sandbox")
    {
        return environment == "production"
            ? "https://api.realexpayments.com/epage-remote.cgi"
            : "https://api.sandbox.realexpayments.com/epage-remote.cgi";
    }

    /// <summary>
    /// Convert ISO 3166-1 numeric country code to alpha-2 code
    /// HPP uses numeric codes (e.g., "840"), but XML API uses alpha-2 codes (e.g., "US")
    /// </summary>
    public static string ConvertCountryCodeToAlpha2(string numericCode)
    {
        if (string.IsNullOrEmpty(numericCode))
            return "US";

        // If already alpha-2 (2 characters), return as-is
        if (numericCode.Length == 2)
            return numericCode.ToUpper();

        // Convert numeric to alpha-2
        return CountryCodeMap.TryGetValue(numericCode, out var alpha2) ? alpha2 : "US";
    }

    /// <summary>
    /// Normalize card expiry format
    /// </summary>
    public static Dictionary<string, string> NormalizeCardExpiry(Dictionary<string, string> cardDetails)
    {
        var normalized = new Dictionary<string, string>(cardDetails);

        // Extract month
        var month = cardDetails.TryGetValue("expmonth", out var m1) ? m1 :
                    cardDetails.TryGetValue("expMonth", out var m2) ? m2 :
                    cardDetails.TryGetValue("exp_month", out var m3) ? m3 :
                    cardDetails.TryGetValue("EXPMONTH", out var m4) ? m4 : "";

        // Extract year
        var year = cardDetails.TryGetValue("expyear", out var y1) ? y1 :
                   cardDetails.TryGetValue("expYear", out var y2) ? y2 :
                   cardDetails.TryGetValue("exp_year", out var y3) ? y3 :
                   cardDetails.TryGetValue("EXPYEAR", out var y4) ? y4 : "";

        // Normalize year to 2 digits
        if (!string.IsNullOrEmpty(year) && year.Length == 4)
            year = year[2..];

        if (!string.IsNullOrEmpty(month))
        {
            normalized["expmonth"] = int.Parse(month).ToString("D2");
            normalized.Remove("expMonth");
            normalized.Remove("exp_month");
            normalized.Remove("EXPMONTH");
        }

        if (!string.IsNullOrEmpty(year))
        {
            normalized["expyear"] = int.Parse(year).ToString("D2");
            normalized.Remove("expYear");
            normalized.Remove("exp_year");
            normalized.Remove("EXPYEAR");
        }

        return normalized;
    }

    /// <summary>
    /// Parse XML response string
    /// </summary>
    public static Dictionary<string, string> ParseXmlResponse(string xmlString)
    {
        var doc = XDocument.Parse(xmlString);
        var result = new Dictionary<string, string>();

        var root = doc.Root;
        if (root == null) return result;

        // Add attributes
        foreach (var attr in root.Attributes())
        {
            result[attr.Name.LocalName] = attr.Value;
        }

        // Add elements
        foreach (var element in root.Elements())
        {
            result[element.Name.LocalName] = element.Value;
        }

        return result;
    }
}
