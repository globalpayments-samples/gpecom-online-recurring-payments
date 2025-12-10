<?php

declare(strict_types=1);

/**
 * HPP Request Generation Script
 *
 * This script generates the HPP (Hosted Payment Page) request JSON
 * for the RealEx HPP JavaScript library.
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 */

// Start output buffering to catch any stray output
ob_start();

require_once 'vendor/autoload.php';
require_once 'XmlApiUtils.php';

use Dotenv\Dotenv;

// Set headers first
header('Content-Type: application/json');
ini_set('display_errors', '0');
error_reporting(0);

// Clean any output that might have occurred
ob_clean();

/**
 * Get XML API configuration from environment variables
 *
 * @return array Configuration array
 */
function getXMLAPIConfig(): array
{
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();

    return [
        'merchantId' => $_ENV['MERCHANT_ID'] ?? '',
        'sharedSecret' => $_ENV['SHARED_SECRET'] ?? '',
        'account' => $_ENV['ACCOUNT'] ?? 'internet',
        'environment' => $_ENV['ENVIRONMENT'] ?? 'sandbox'
    ];
}

/**
 * Validate required environment variables
 *
 * @param array $config Configuration array
 * @throws Exception if required variables are missing
 */
function validateConfig(array $config): void
{
    $missing = [];

    if (empty($config['merchantId'])) {
        $missing[] = 'MERCHANT_ID';
    }
    if (empty($config['sharedSecret'])) {
        $missing[] = 'SHARED_SECRET';
    }

    if (!empty($missing)) {
        throw new Exception('Missing required environment variables: ' . implode(', ', $missing));
    }
}

/**
 * Generate HPP hash
 * Hash blueprint: timestamp.merchantid.orderid.amount.currency
 */
function generateHPPHash(array $params, string $sharedSecret): string
{
    $timestamp = $params['timestamp'];
    $merchantId = $params['merchantId'];
    $orderId = $params['orderId'];
    $amount = $params['amount'];
    $currency = $params['currency'];

    $dataString = "{$timestamp}.{$merchantId}.{$orderId}.{$amount}.{$currency}";
    
    return XmlApiUtils::generateSha1Hash($dataString, $sharedSecret);
}

/**
 * Convert amount to cents
 */
function convertToCents(float $amount): int
{
    return (int)round($amount * 100);
}

try {
    // Get and validate configuration
    $config = getXMLAPIConfig();
    validateConfig($config);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Configuration error: ' . $e->getMessage(),
        'error' => [
            'code' => 'CONFIG_ERROR',
            'details' => $e->getMessage()
        ]
    ]);
    exit;
}

try {
    // Read JSON request body
    $requestBody = file_get_contents('php://input');
    $jsonRequest = json_decode($requestBody, true);

    if ($jsonRequest === null) {
        throw new Exception('Invalid request body - must be valid JSON');
    }

    // Extract request parameters
    $amount = isset($jsonRequest['amount']) ? floatval($jsonRequest['amount']) : 0;
    $currency = $jsonRequest['currency'] ?? 'USD';
    $customerEmail = $jsonRequest['customer_email'] ?? null;
    $customerPhone = $jsonRequest['customer_phone'] ?? null;
    $billingStreet1 = $jsonRequest['billing_street1'] ?? null;
    $billingStreet2 = $jsonRequest['billing_street2'] ?? null;
    $billingStreet3 = $jsonRequest['billing_street3'] ?? null;
    $billingCity = $jsonRequest['billing_city'] ?? null;
    $billingPostalcode = $jsonRequest['billing_postalcode'] ?? null;
    $billingCountry = $jsonRequest['billing_country'] ?? null;

    // Validate required fields
    if ($amount <= 0) {
        throw new Exception('Valid amount is required');
    }

    // Generate request parameters
    $timestamp = XmlApiUtils::generateTimestamp();
    $orderId = XmlApiUtils::generateOrderId('HPP');
    $amountInCents = convertToCents($amount);

    // Generate hash
    $hash = generateHPPHash([
        'timestamp' => $timestamp,
        'merchantId' => $config['merchantId'],
        'orderId' => $orderId,
        'amount' => $amountInCents,
        'currency' => $currency
    ], $config['sharedSecret']);

    // Get protocol and host
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    // Build HPP request JSON
    $hppRequest = [
        'TIMESTAMP' => $timestamp,
        'MERCHANT_ID' => $config['merchantId'],
        'ACCOUNT' => $config['account'],
        'ORDER_ID' => $orderId,
        'AMOUNT' => $amountInCents,
        'CURRENCY' => $currency,
        'AUTO_SETTLE_FLAG' => '1',
        'HPP_VERSION' => '2',
        'HPP_CHANNEL' => 'ECOM',
        'MERCHANT_RESPONSE_URL' => "{$protocol}://{$host}/hpp-response.php",
        'SHA1HASH' => $hash
    ];

    // Add optional customer fields
    if ($customerEmail) {
        $hppRequest['HPP_CUSTOMER_EMAIL'] = $customerEmail;
    }
    if ($customerPhone) {
        $hppRequest['HPP_CUSTOMER_PHONENUMBER_MOBILE'] = $customerPhone;
    }

    // Add billing address fields
    if ($billingStreet1) {
        $hppRequest['HPP_BILLING_STREET1'] = $billingStreet1;
    }
    if ($billingStreet2) {
        $hppRequest['HPP_BILLING_STREET2'] = $billingStreet2;
    }
    if ($billingStreet3) {
        $hppRequest['HPP_BILLING_STREET3'] = $billingStreet3;
    }
    if ($billingCity) {
        $hppRequest['HPP_BILLING_CITY'] = $billingCity;
    }
    if ($billingPostalcode) {
        $hppRequest['HPP_BILLING_POSTALCODE'] = $billingPostalcode;
    }
    if ($billingCountry) {
        $hppRequest['HPP_BILLING_COUNTRY'] = $billingCountry;
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'HPP request generated successfully',
        'data' => $hppRequest
    ]);

} catch (Exception $e) {
    // Handle errors
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'HPP request generation error: ' . $e->getMessage(),
        'error' => [
            'code' => 'HPP_REQUEST_ERROR',
            'details' => $e->getMessage()
        ]
    ]);
}
