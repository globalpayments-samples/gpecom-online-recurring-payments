<?php

declare(strict_types=1);

/**
 * Global Payments XML API Utilities
 *
 * Provides utility functions for XML API integration including:
 * - SHA-1 hash generation for request authentication
 * - Timestamp formatting
 * - XML request building
 * - XML response parsing
 * - Country code conversion
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 */

class XmlApiUtils
{
    private const COUNTRY_CODE_MAP = [
        '036' => 'AU', // Australia
        '124' => 'CA', // Canada
        '276' => 'DE', // Germany
        '372' => 'IE', // Ireland
        '826' => 'GB', // United Kingdom
        '840' => 'US', // United States
        '250' => 'FR', // France
        '380' => 'IT', // Italy
        '724' => 'ES', // Spain
        '528' => 'NL', // Netherlands
        '056' => 'BE', // Belgium
        '208' => 'DK', // Denmark
        '246' => 'FI', // Finland
        '578' => 'NO', // Norway
        '752' => 'SE', // Sweden
        '756' => 'CH', // Switzerland
        '040' => 'AT', // Austria
        '620' => 'PT', // Portugal
        '616' => 'PL', // Poland
        '203' => 'CZ'  // Czech Republic
    ];

    private const FREQUENCY_MAP = [
        'weekly' => 'weekly',
        'bi-weekly' => 'biweekly',
        'biweekly' => 'biweekly',
        'monthly' => 'monthly',
        'quarterly' => 'quarterly',
        'yearly' => 'yearly',
        'annually' => 'yearly'
    ];

    /**
     * Generate timestamp in XML API format: YYYYMMDDHHMMSS
     */
    public static function generateTimestamp(): string
    {
        return date('YmdHis');
    }

    /**
     * Generate unique order ID
     */
    public static function generateOrderId(string $prefix = 'ORD'): string
    {
        $timestamp = (int)(microtime(true) * 1000);
        $randomNum = rand(0, 999);
        return sprintf('%s_%d_%d', $prefix, $timestamp, $randomNum);
    }

    /**
     * Generate SHA-1 hash for XML API authentication
     *
     * XML API uses a two-step hashing process:
     * 1. Hash the concatenated request values
     * 2. Hash the result with the shared secret appended
     */
    public static function generateSha1Hash(string $dataString, string $sharedSecret): string
    {
        // First hash
        $firstHash = sha1($dataString);

        // Second hash with shared secret
        $secondString = $firstHash . '.' . $sharedSecret;
        $finalHash = sha1($secondString);

        return $finalHash;
    }

    /**
     * Generate hash for payer-new request
     */
    public static function generatePayerNewHash(
        string $timestamp,
        string $merchantId,
        string $orderId,
        string $payerRef,
        string $sharedSecret
    ): string {
        $dataString = sprintf('%s.%s.%s...%s', $timestamp, $merchantId, $orderId, $payerRef);
        return self::generateSha1Hash($dataString, $sharedSecret);
    }

    /**
     * Generate hash for card-new request
     */
    public static function generateCardNewHash(
        string $timestamp,
        string $merchantId,
        string $orderId,
        string $payerRef,
        string $chname,
        string $cardNumber,
        string $sharedSecret
    ): string {
        $dataString = sprintf('%s.%s.%s...%s.%s.%s', $timestamp, $merchantId, $orderId, $payerRef, $chname, $cardNumber);
        return self::generateSha1Hash($dataString, $sharedSecret);
    }

    /**
     * Generate hash for receipt-in (stored card payment) request
     */
    public static function generateStoredCardPaymentHash(
        string $timestamp,
        string $merchantId,
        string $orderId,
        int $amount,
        string $currency,
        string $payerRef,
        string $sharedSecret
    ): string {
        $dataString = sprintf('%s.%s.%s.%d.%s.%s', $timestamp, $merchantId, $orderId, $amount, $currency, $payerRef);
        return self::generateSha1Hash($dataString, $sharedSecret);
    }

    /**
     * Generate hash for schedule-new request
     */
    public static function generateScheduleHash(
        string $timestamp,
        string $merchantId,
        string $scheduleRef,
        int $amount,
        string $currency,
        string $payerRef,
        string $schedule,
        string $sharedSecret
    ): string {
        $dataString = sprintf('%s.%s.%s.%d.%s.%s.%s', $timestamp, $merchantId, $scheduleRef, $amount, $currency, $payerRef, $schedule);
        return self::generateSha1Hash($dataString, $sharedSecret);
    }

    /**
     * Convert dollar amount to cents
     */
    public static function convertToCents(float $amount): int
    {
        return (int)round($amount * 100);
    }

    /**
     * Convert cents to dollars
     */
    public static function convertFromCents(int $cents): float
    {
        return $cents / 100.0;
    }

    /**
     * Sanitize postal code
     */
    public static function sanitizePostalCode(string $postalCode): string
    {
        if (empty($postalCode)) {
            return '';
        }
        $sanitized = str_replace([' ', '-'], '', $postalCode);
        return substr($sanitized, 0, 16);
    }

    /**
     * Sanitize alphanumeric string
     */
    public static function sanitizeAlphanumeric(string $value, int $maxLength = 255): string
    {
        if (empty($value)) {
            return '';
        }
        // Remove any potentially problematic characters
        $sanitized = preg_replace('/[^a-zA-Z0-9 .,@_-]/', '', $value);
        return substr($sanitized, 0, $maxLength);
    }

    /**
     * Map frequency to schedule format
     */
    public static function mapFrequencyToSchedule(string $frequency): string
    {
        $frequencyLower = strtolower($frequency);
        return self::FREQUENCY_MAP[$frequencyLower] ?? 'monthly';
    }

    /**
     * Get XML API endpoint based on environment
     */
    public static function getXmlApiEndpoint(string $environment = 'sandbox'): string
    {
        return $environment === 'production'
            ? 'https://api.realexpayments.com/epage-remote.cgi'
            : 'https://api.sandbox.realexpayments.com/epage-remote.cgi';
    }

    /**
     * Convert ISO 3166-1 numeric country code to alpha-2 code
     * HPP uses numeric codes (e.g., "840"), but XML API uses alpha-2 codes (e.g., "US")
     */
    public static function convertCountryCodeToAlpha2(string $numericCode): string
    {
        if (empty($numericCode)) {
            return 'US';
        }

        // If already alpha-2 (2 characters), return as-is
        if (strlen($numericCode) === 2) {
            return strtoupper($numericCode);
        }

        // Convert numeric to alpha-2
        return self::COUNTRY_CODE_MAP[$numericCode] ?? 'US';
    }

    /**
     * Normalize card expiry format
     */
    public static function normalizeCardExpiry(array $cardDetails): array
    {
        $normalized = $cardDetails;

        // Extract month
        $month = $cardDetails['expmonth'] ?? $cardDetails['expMonth'] ?? $cardDetails['exp_month'] ?? $cardDetails['EXPMONTH'] ?? '';

        // Extract year
        $year = $cardDetails['expyear'] ?? $cardDetails['expYear'] ?? $cardDetails['exp_year'] ?? $cardDetails['EXPYEAR'] ?? '';

        // Normalize year to 2 digits
        if (!empty($year) && strlen($year) === 4) {
            $year = substr($year, 2);
        }

        if (!empty($month)) {
            $normalized['expmonth'] = sprintf('%02d', (int)$month);
            unset($normalized['expMonth'], $normalized['exp_month'], $normalized['EXPMONTH']);
        }

        if (!empty($year)) {
            $normalized['expyear'] = sprintf('%02d', (int)$year);
            unset($normalized['expYear'], $normalized['exp_year'], $normalized['EXPYEAR']);
        }

        return $normalized;
    }

    /**
     * Build XML request string
     */
    public static function buildXmlRequest(string $requestType, string $timestamp, array $data): string
    {
        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><request></request>');
        $xml->addAttribute('type', $requestType);
        $xml->addAttribute('timestamp', $timestamp);

        self::arrayToXml($data, $xml);

        return $xml->asXML();
    }

    /**
     * Convert array to XML recursively
     */
    private static function arrayToXml(array $data, SimpleXMLElement $xml): void
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                if (isset($value['@attributes'])) {
                    $subnode = $xml->addChild($key, $value['@value'] ?? '');
                    foreach ($value['@attributes'] as $attrKey => $attrValue) {
                        $subnode->addAttribute($attrKey, $attrValue);
                    }
                    if (isset($value['@children'])) {
                        self::arrayToXml($value['@children'], $subnode);
                    }
                } else {
                    $subnode = $xml->addChild($key);
                    self::arrayToXml($value, $subnode);
                }
            } else {
                $xml->addChild($key, htmlspecialchars((string)$value));
            }
        }
    }

    /**
     * Parse XML response string
     */
    public static function parseXmlResponse(string $xmlString): array
    {
        $xml = simplexml_load_string($xmlString);
        if ($xml === false) {
            throw new Exception('Failed to parse XML response');
        }

        $result = [];

        // Add attributes
        foreach ($xml->attributes() as $key => $value) {
            $result[$key] = (string)$value;
        }

        // Add elements
        foreach ($xml->children() as $key => $value) {
            $result[$key] = (string)$value;
        }

        return $result;
    }
}
