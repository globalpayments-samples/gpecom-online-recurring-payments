<?php

declare(strict_types=1);

/**
 * Card Payment Processing Script
 *
 * This script demonstrates card payment processing using the Global Payments XML API.
 * It handles card data and billing information to process payments
 * securely through the Global Payments XML API endpoint.
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 * @link      https://github.com/globalpayments
 */

// Start output buffering to catch any stray output
ob_start();

require_once 'vendor/autoload.php';
require_once 'PaymentUtils.php';

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
    // Extract request parameters
    $paymentToken = $_POST['payment_token'] ?? null;
    $amount = isset($_POST['amount']) ? floatval($_POST['amount']) : 0;
    $currency = $_POST['currency'] ?? 'USD';
    
    // Customer data
    $firstName = $_POST['first_name'] ?? '';
    $lastName = $_POST['last_name'] ?? '';
    $email = $_POST['email'] ?? '';
    $phone = $_POST['phone'] ?? '';
    
    // Billing data
    $billingZip = $_POST['billing_zip'] ?? '';
    $streetAddress = $_POST['street_address'] ?? '';
    $city = $_POST['city'] ?? '';
    $state = $_POST['state'] ?? '';
    $country = $_POST['country'] ?? 'US';

    // Validate required fields
    if (empty($paymentToken)) {
        throw new Exception('Payment token is required');
    }

    if ($amount <= 0) {
        throw new Exception('Valid amount is required');
    }

    // Prepare billing data
    $billingData = [
        'billing_zip' => $billingZip,
        'street_address' => $streetAddress,
        'city' => $city,
        'state' => $state,
        'country' => $country
    ];

    // Prepare customer data
    $customerData = [
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'phone' => $phone,
        'billing_zip' => $billingZip,
        'city' => $city,
        'state' => $state,
        'country' => $country,
        'street_address' => $streetAddress
    ];

    // Parse payment token - it should contain card data as JSON
    $cardData = json_decode($paymentToken, true);
    if ($cardData === null) {
        // If not JSON, treat as simple token/card number
        $cardData = [
            'number' => $paymentToken,
            'expmonth' => '12',
            'expyear' => '25',
            'cvn' => '123',
            'chname' => trim("$firstName $lastName") ?: 'Card Holder'
        ];
    }

    // Process one-time payment
    $result = PaymentUtils::processOneTimePayment($config, [
        'token' => $cardData,
        'amount' => $amount,
        'currency' => $currency,
        'billingData' => $billingData,
        'customerData' => $customerData
    ]);

    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Payment processed successfully',
        'data' => $result
    ]);

} catch (Exception $e) {
    // Handle payment processing errors
    $errorCode = 'PAYMENT_ERROR';
    $statusCode = 500;

    $errorMessage = $e->getMessage();

    // Determine appropriate error code based on error message
    if (stripos($errorMessage, 'authentication') !== false || stripos($errorMessage, 'hash') !== false) {
        $errorCode = 'AUTH_ERROR';
        $statusCode = 401;
    } elseif (stripos($errorMessage, 'declined') !== false || stripos($errorMessage, 'insufficient') !== false) {
        $errorCode = 'DECLINED';
        $statusCode = 402;
    } elseif (stripos($errorMessage, 'invalid') !== false) {
        $errorCode = 'INVALID_REQUEST';
        $statusCode = 400;
    }

    http_response_code($statusCode);
    echo json_encode([
        'success' => false,
        'message' => 'Payment processing failed: ' . $errorMessage,
        'error' => [
            'code' => $errorCode,
            'details' => $errorMessage
        ]
    ]);
}
