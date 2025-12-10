<?php

declare(strict_types=1);

/**
 * HPP Response Handler Script
 *
 * This script handles the response from the Hosted Payment Page (HPP)
 * and displays the payment result to the user.
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 */

require_once 'vendor/autoload.php';
require_once 'XmlApiUtils.php';

use Dotenv\Dotenv;

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
 * Generate HPP response hash for verification
 * Hash blueprint: timestamp.merchantid.orderid.result.message.pasref.authcode
 */
function generateHPPResponseHash(array $params, string $sharedSecret): string
{
    $timestamp = $params['timestamp'];
    $merchantId = $params['merchantId'];
    $orderId = $params['orderId'];
    $result = $params['result'];
    $message = $params['message'];
    $pasref = $params['pasref'];
    $authcode = $params['authcode'];

    $dataString = "{$timestamp}.{$merchantId}.{$orderId}.{$result}.{$message}.{$pasref}.{$authcode}";
    
    return XmlApiUtils::generateSha1Hash($dataString, $sharedSecret);
}

$config = getXMLAPIConfig();

// Extract response parameters
$timestamp = $_POST['TIMESTAMP'] ?? '';
$merchantId = $_POST['MERCHANT_ID'] ?? '';
$orderId = $_POST['ORDER_ID'] ?? '';
$result = $_POST['RESULT'] ?? '';
$message = $_POST['MESSAGE'] ?? '';
$pasref = $_POST['PASREF'] ?? '';
$authcode = $_POST['AUTHCODE'] ?? '';
$sha1hash = $_POST['SHA1HASH'] ?? '';
$amount = $_POST['AMOUNT'] ?? '';
$currency = $_POST['CURRENCY'] ?? '';

// Verify hash
$expectedHash = generateHPPResponseHash([
    'timestamp' => $timestamp,
    'merchantId' => $merchantId,
    'orderId' => $orderId,
    'result' => $result,
    'message' => $message,
    'pasref' => $pasref,
    'authcode' => $authcode
], $config['sharedSecret']);

if (strtolower($expectedHash) !== strtolower($sha1hash)) {
    // Hash verification failed
    echo '<!DOCTYPE html>
    <html>
    <head>
        <title>Payment Failed</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #dc3545; }
        </style>
    </head>
    <body>
        <h1 class="error">Payment Verification Failed</h1>
        <p>The payment response could not be verified. Please contact support.</p>
        <button onclick="window.close()">Close Window</button>
    </body>
    </html>';
    exit;
}

// Check result
if ($result === '00') {
    // Success
    echo '<!DOCTYPE html>
    <html>
    <head>
        <title>Payment Successful</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #28a745; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1 class="success">✅ Payment Successful</h1>
        <div class="info">
            <p><strong>Order ID:</strong> ' . htmlspecialchars($orderId) . '</p>
            <p><strong>Transaction ID:</strong> ' . htmlspecialchars($pasref) . '</p>
            <p><strong>Authorization Code:</strong> ' . htmlspecialchars($authcode) . '</p>
            <p><strong>Amount:</strong> ' . htmlspecialchars($amount) . ' ' . htmlspecialchars($currency) . '</p>
        </div>
        <p>' . htmlspecialchars($message) . '</p>
        <button onclick="window.close()">Close Window</button>
    </body>
    </html>';
} else {
    // Failed
    echo '<!DOCTYPE html>
    <html>
    <head>
        <title>Payment Failed</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #dc3545; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1 class="error">❌ Payment Failed</h1>
        <div class="info">
            <p><strong>Order ID:</strong> ' . htmlspecialchars($orderId) . '</p>
            <p><strong>Error Code:</strong> ' . htmlspecialchars($result) . '</p>
        </div>
        <p>' . htmlspecialchars($message) . '</p>
        <button onclick="window.close()">Close Window</button>
    </body>
    </html>';
}
