<?php

declare(strict_types=1);

/**
 * Recurring Payment Setup Script
 *
 * This script handles XML API recurring payment setup including:
 * - Customer creation in Card Storage
 * - Card reference storage
 * - Initial payment processing
 * - Recurring schedule creation
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 */

require_once 'vendor/autoload.php';
require_once 'PaymentUtils.php';

use Dotenv\Dotenv;

ini_set('display_errors', '0');
header('Content-Type: application/json');

try {
    // Load environment variables
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();

    // Read and parse JSON request body
    $requestBody = file_get_contents('php://input');
    $jsonRequest = json_decode($requestBody, true);

    if ($jsonRequest === null) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid request body',
            'error' => [
                'code' => 'INVALID_REQUEST',
                'details' => 'Request body must be valid JSON'
            ]
        ]);
        exit;
    }

    // Validate required card fields
    if (!isset($jsonRequest['card_number']) || !isset($jsonRequest['card_expiry']) || !isset($jsonRequest['card_cvv'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Card information required',
            'error' => [
                'code' => 'MISSING_CARD_INFO',
                'details' => 'Card number, expiry, and CVV are required'
            ]
        ]);
        exit;
    }

    // Validate required recurring fields
    if (!isset($jsonRequest['amount']) || !isset($jsonRequest['frequency']) || !isset($jsonRequest['start_date'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Recurring payment details required',
            'error' => [
                'code' => 'MISSING_RECURRING_INFO',
                'details' => 'Amount, frequency, and start date are required'
            ]
        ]);
        exit;
    }

    // Validate required customer fields
    if (!isset($jsonRequest['first_name']) || !isset($jsonRequest['last_name']) || !isset($jsonRequest['email'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Customer information required',
            'error' => [
                'code' => 'MISSING_CUSTOMER_INFO',
                'details' => 'First name, last name, and email are required'
            ]
        ]);
        exit;
    }

    // Parse card expiry (MM/YY format)
    $cardExpiry = $jsonRequest['card_expiry'];
    $expiryParts = explode('/', $cardExpiry);
    if (count($expiryParts) !== 2) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid card expiry format. Expected MM/YY',
            'error' => [
                'code' => 'INVALID_EXPIRY',
                'details' => 'Card expiry must be in MM/YY format'
            ]
        ]);
        exit;
    }

    $expMonth = trim($expiryParts[0]);
    $expYear = trim($expiryParts[1]);

    // Ensure month is 2 digits
    if (strlen($expMonth) === 1) {
        $expMonth = '0' . $expMonth;
    }

    // Prepare card details
    $cardDetails = [
        'number' => str_replace(' ', '', $jsonRequest['card_number']),
        'expmonth' => $expMonth,
        'expyear' => $expYear,
        'cvn' => $jsonRequest['card_cvv']
    ];

    // Get card name or construct from customer name
    $cardName = $jsonRequest['card_name'] ?? ($jsonRequest['first_name'] . ' ' . $jsonRequest['last_name']);
    $cardDetails['chname'] = $cardName;

    // Prepare customer data
    $customerData = [
        'first_name' => $jsonRequest['first_name'],
        'last_name' => $jsonRequest['last_name'],
        'email' => $jsonRequest['email'],
        'phone' => $jsonRequest['phone'] ?? '',
        'street_address' => $jsonRequest['street_address'] ?? '',
        'city' => $jsonRequest['city'] ?? '',
        'state' => $jsonRequest['state'] ?? '',
        'billing_zip' => $jsonRequest['billing_zip'] ?? '',
        'country' => $jsonRequest['billing_country'] ?? ''
    ];

    // Prepare billing data
    $billingData = [
        'billing_zip' => $jsonRequest['billing_zip'] ?? '',
        'country' => $jsonRequest['billing_country'] ?? '',
        'street_address' => $jsonRequest['street_address'] ?? '',
        'city' => $jsonRequest['city'] ?? '',
        'state' => $jsonRequest['state'] ?? ''
    ];

    // Set currency default
    $currency = $jsonRequest['currency'] ?? 'USD';

    // Prepare configuration
    $config = [
        'merchantId' => $_ENV['MERCHANT_ID'],
        'sharedSecret' => $_ENV['SHARED_SECRET'],
        'account' => $_ENV['ACCOUNT'] ?? 'internet',
        'environment' => $_ENV['ENVIRONMENT'] ?? 'sandbox'
    ];

    // Prepare payment data
    $paymentData = [
        'cardDetails' => $cardDetails,
        'amount' => (float)$jsonRequest['amount'],
        'currency' => $currency,
        'frequency' => $jsonRequest['frequency'],
        'startDate' => $jsonRequest['start_date'],
        'customerData' => $customerData,
        'billingData' => $billingData
    ];

    // Process recurring payment setup
    $result = PaymentUtils::processRecurringPaymentSetup($config, $paymentData);

    // Send success response
    echo json_encode([
        'success' => true,
        'message' => 'Recurring payment setup completed successfully',
        'data' => $result
    ]);

} catch (Exception $e) {
    // Log the error
    error_log('Error processing recurring setup: ' . $e->getMessage());
    error_log($e->getTraceAsString());

    // Send error response
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error' => [
            'code' => 'PROCESSING_ERROR',
            'details' => $e->getMessage()
        ]
    ]);
}
