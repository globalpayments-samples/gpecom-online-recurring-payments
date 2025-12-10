<?php

declare(strict_types=1);

/**
 * Payment Processing Utilities for XML API
 *
 * This class handles:
 * - One-time payment processing
 * - Recurring payment setup
 * - Customer and payment method storage
 * - Payment Scheduler integration
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 */

require_once 'XmlApiUtils.php';

class PaymentUtils
{
    /**
     * Create or update customer (payer) in Card Storage
     */
    public static function createOrUpdateCustomer(array $config, array $customerData): array
    {
        $merchantId = $config['merchantId'];
        $sharedSecret = $config['sharedSecret'];
        $environment = $config['environment'] ?? 'sandbox';

        $payerRef = $customerData['payerRef'];
        $firstName = $customerData['firstName'] ?? '';
        $lastName = $customerData['lastName'] ?? '';
        $email = $customerData['email'] ?? '';
        $phone = $customerData['phone'] ?? '';
        $address = $customerData['address'] ?? [];

        $timestamp = XmlApiUtils::generateTimestamp();
        $orderId = XmlApiUtils::generateOrderId('CUST');

        // Generate hash for payer-new
        $hashVal = XmlApiUtils::generatePayerNewHash($timestamp, $merchantId, $orderId, $payerRef, $sharedSecret);

        // Build XML request
        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><request></request>');
        $xml->addAttribute('type', 'payer-new');
        $xml->addAttribute('timestamp', $timestamp);
        $xml->addChild('merchantid', $merchantId);
        $xml->addChild('orderid', $orderId);

        $payer = $xml->addChild('payer');
        $payer->addAttribute('type', 'Retail');
        $payer->addAttribute('ref', $payerRef);
        $payer->addChild('title', '');
        $payer->addChild('firstname', XmlApiUtils::sanitizeAlphanumeric($firstName, 100));
        $payer->addChild('surname', XmlApiUtils::sanitizeAlphanumeric($lastName, 100));
        $payer->addChild('company', '');

        // Add address if provided
        if (!empty($address)) {
            $countryCode = XmlApiUtils::convertCountryCodeToAlpha2($address['country'] ?? 'US');
            $addressNode = $payer->addChild('address');
            $addressNode->addChild('line1', XmlApiUtils::sanitizeAlphanumeric($address['street_address'] ?? '', 50));
            $addressNode->addChild('line2', '');
            $addressNode->addChild('line3', '');
            $addressNode->addChild('city', XmlApiUtils::sanitizeAlphanumeric($address['city'] ?? '', 40));
            $addressNode->addChild('county', XmlApiUtils::sanitizeAlphanumeric($address['state'] ?? '', 40));
            $addressNode->addChild('postcode', XmlApiUtils::sanitizePostalCode($address['billing_zip'] ?? ''));
            $country = $addressNode->addChild('country', $countryCode);
            $country->addAttribute('code', $countryCode);
        }

        // Add phone if provided
        if (!empty($phone)) {
            $phoneNumbers = $payer->addChild('phonenumbers');
            $phoneNumbers->addChild('home', XmlApiUtils::sanitizeAlphanumeric($phone, 20));
        }

        // Add email
        $payer->addChild('email', XmlApiUtils::sanitizeAlphanumeric($email, 255));

        $xml->addChild('sha1hash', $hashVal);

        // Send request
        $xmlRequest = $xml->asXML();
        $endpoint = XmlApiUtils::getXmlApiEndpoint($environment);

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xmlRequest);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/xml']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception('Failed to send request: ' . $curlError);
        }

        $parsedResponse = XmlApiUtils::parseXmlResponse($response);

        // Check result (00 = success, 501 = payer already exists - both acceptable)
        $result = $parsedResponse['result'];
        if ($result !== '00' && $result !== '501') {
            throw new Exception("Customer creation failed: {$parsedResponse['message']} (Code: $result)");
        }

        return [
            'success' => true,
            'payerRef' => $payerRef,
            'message' => $parsedResponse['message'],
            'alreadyExists' => $result === '501'
        ];
    }

    /**
     * Create card reference in Card Storage API
     */
    public static function createCardReference(array $config, array $cardData): array
    {
        $merchantId = $config['merchantId'];
        $sharedSecret = $config['sharedSecret'];
        $environment = $config['environment'] ?? 'sandbox';

        $paymentMethodRef = $cardData['paymentMethodRef'];
        $payerRef = $cardData['payerRef'];
        $cardholderName = $cardData['cardholderName'];
        $cardDetails = $cardData['cardDetails'];

        $timestamp = XmlApiUtils::generateTimestamp();
        $orderId = XmlApiUtils::generateOrderId('CARD');

        $sanitizedName = XmlApiUtils::sanitizeAlphanumeric($cardholderName, 100);

        // Generate hash for card-new
        $hashVal = XmlApiUtils::generateCardNewHash($timestamp, $merchantId, $orderId, $payerRef, $sanitizedName, $cardDetails['number'], $sharedSecret);

        // Build XML request
        $expDate = $cardDetails['expmonth'] . $cardDetails['expyear'];
        $cardType = $cardDetails['type'] ?? 'VISA';

        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><request></request>');
        $xml->addAttribute('type', 'card-new');
        $xml->addAttribute('timestamp', $timestamp);
        $xml->addChild('merchantid', $merchantId);
        $xml->addChild('orderid', $orderId);

        $card = $xml->addChild('card');
        $card->addChild('ref', $paymentMethodRef);
        $card->addChild('payerref', $payerRef);
        $card->addChild('chname', $sanitizedName);
        $card->addChild('number', $cardDetails['number']);
        $card->addChild('expdate', $expDate);
        $card->addChild('type', $cardType);

        $xml->addChild('sha1hash', $hashVal);

        // Send request
        $xmlRequest = $xml->asXML();
        $endpoint = XmlApiUtils::getXmlApiEndpoint($environment);

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xmlRequest);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/xml']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception('Failed to send request: ' . $curlError);
        }

        $parsedResponse = XmlApiUtils::parseXmlResponse($response);

        // Check result (00 = success, 520 = card already exists - both acceptable)
        $result = $parsedResponse['result'];
        if ($result !== '00' && $result !== '520') {
            throw new Exception("Card reference creation failed: {$parsedResponse['message']} (Code: $result)");
        }

        return [
            'success' => true,
            'paymentMethodRef' => $paymentMethodRef,
            'payerRef' => $payerRef,
            'message' => $parsedResponse['message'],
            'alreadyExists' => $result === '520'
        ];
    }

    /**
     * Store payment method (card) for recurring use with initial payment
     */
    public static function storePaymentMethodWithInitialPayment(array $config, array $paymentData): array
    {
        $merchantId = $config['merchantId'];
        $sharedSecret = $config['sharedSecret'];
        $account = $config['account'] ?? 'internet';
        $environment = $config['environment'] ?? 'sandbox';

        $paymentMethodRef = $paymentData['paymentMethodRef'];
        $payerRef = $paymentData['payerRef'];
        $amount = $paymentData['amount'];
        $currency = $paymentData['currency'] ?? 'USD';
        $billingData = $paymentData['billingData'] ?? [];

        $timestamp = XmlApiUtils::generateTimestamp();
        $orderId = XmlApiUtils::generateOrderId('INIT');
        $amountInCents = XmlApiUtils::convertToCents($amount);

        // Generate hash for receipt-in
        $hashVal = XmlApiUtils::generateStoredCardPaymentHash($timestamp, $merchantId, $orderId, $amountInCents, $currency, $payerRef, $sharedSecret);

        // Build XML request
        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><request></request>');
        $xml->addAttribute('type', 'receipt-in');
        $xml->addAttribute('timestamp', $timestamp);
        $xml->addChild('merchantid', $merchantId);
        $xml->addChild('account', $account);
        $xml->addChild('orderid', $orderId);

        $amountNode = $xml->addChild('amount', (string)$amountInCents);
        $amountNode->addAttribute('currency', $currency);

        $xml->addChild('payerref', $payerRef);
        $xml->addChild('paymentmethod', $paymentMethodRef);

        $autosettle = $xml->addChild('autosettle');
        $autosettle->addAttribute('flag', '1');

        $recurring = $xml->addChild('recurring');
        $recurring->addAttribute('type', 'fixed');
        $recurring->addAttribute('sequence', 'first');

        // Add billing information
        if (!empty($billingData['billing_zip'])) {
            $country = XmlApiUtils::convertCountryCodeToAlpha2($billingData['country'] ?? 'US');
            $tssinfo = $xml->addChild('tssinfo');
            $addressNode = $tssinfo->addChild('address');
            $addressNode->addChild('code', XmlApiUtils::sanitizePostalCode($billingData['billing_zip']));
            $addressNode->addChild('country', $country);
        }

        $xml->addChild('sha1hash', $hashVal);

        // Send request
        $xmlRequest = $xml->asXML();
        $endpoint = XmlApiUtils::getXmlApiEndpoint($environment);

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xmlRequest);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/xml']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception('Failed to send request: ' . $curlError);
        }

        $parsedResponse = XmlApiUtils::parseXmlResponse($response);

        // Check if payment was successful
        $result = $parsedResponse['result'];
        if ($result !== '00') {
            throw new Exception("Initial payment failed: {$parsedResponse['message']} (Code: $result)");
        }

        return [
            'success' => true,
            'transactionId' => $parsedResponse['pasref'],
            'orderId' => $parsedResponse['orderid'],
            'authCode' => $parsedResponse['authcode'],
            'payerRef' => $payerRef,
            'paymentMethodRef' => $paymentMethodRef,
            'amount' => $amount,
            'currency' => $currency,
            'message' => 'Initial payment successful - payment method stored for recurring use',
            'timestamp' => $parsedResponse['timestamp']
        ];
    }

    /**
     * Create recurring payment schedule using Payment Scheduler API
     */
    public static function createRecurringSchedule(array $config, array $scheduleData): array
    {
        $merchantId = $config['merchantId'];
        $sharedSecret = $config['sharedSecret'];
        $account = $config['account'] ?? 'internet';
        $environment = $config['environment'] ?? 'sandbox';

        $scheduleRef = $scheduleData['scheduleRef'];
        $payerRef = $scheduleData['payerRef'];
        $paymentMethodRef = $scheduleData['paymentMethodRef'];
        $amount = $scheduleData['amount'];
        $currency = $scheduleData['currency'] ?? 'USD';
        $frequency = $scheduleData['frequency'];
        $startDate = $scheduleData['startDate'] ?? '';
        $numTimes = $scheduleData['numTimes'] ?? -1;

        $timestamp = XmlApiUtils::generateTimestamp();
        $amountInCents = XmlApiUtils::convertToCents($amount);
        $schedule = XmlApiUtils::mapFrequencyToSchedule($frequency);

        // Generate hash for schedule-new
        $hashVal = XmlApiUtils::generateScheduleHash($timestamp, $merchantId, $scheduleRef, $amountInCents, $currency, $payerRef, $schedule, $sharedSecret);

        // Build XML request
        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><request></request>');
        $xml->addAttribute('type', 'schedule-new');
        $xml->addAttribute('timestamp', $timestamp);
        $xml->addChild('merchantid', $merchantId);
        $xml->addChild('account', $account);
        $xml->addChild('scheduleref', $scheduleRef);
        $xml->addChild('transtype', 'auth');
        $xml->addChild('schedule', $schedule);
        $xml->addChild('numtimes', (string)$numTimes);
        $xml->addChild('payerref', $payerRef);
        $xml->addChild('paymentmethod', $paymentMethodRef);

        $amountNode = $xml->addChild('amount', (string)$amountInCents);
        $amountNode->addAttribute('currency', $currency);

        $xml->addChild('sha1hash', $hashVal);

        // Send request
        $xmlRequest = $xml->asXML();
        $endpoint = XmlApiUtils::getXmlApiEndpoint($environment);

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xmlRequest);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/xml']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception('Failed to send request: ' . $curlError);
        }

        $parsedResponse = XmlApiUtils::parseXmlResponse($response);

        // Check if schedule was created successfully
        $result = $parsedResponse['result'];
        if ($result !== '00') {
            throw new Exception("Schedule creation failed: {$parsedResponse['message']} (Code: $result)");
        }

        return [
            'success' => true,
            'scheduleRef' => $scheduleRef,
            'scheduleText' => $parsedResponse['scheduletext'] ?? '',
            'message' => $parsedResponse['message'],
            'frequency' => $frequency,
            'startDate' => $startDate,
            'amount' => $amount,
            'currency' => $currency,
            'numTimes' => $numTimes
        ];
    }

    /**
     * Process complete recurring payment setup
     */
    public static function processRecurringPaymentSetup(array $config, array $data): array
    {
        $cardDetails = $data['cardDetails'];
        $amount = $data['amount'];
        $currency = $data['currency'] ?? 'USD';
        $frequency = $data['frequency'];
        $startDate = $data['startDate'];
        $customerData = $data['customerData'];
        $billingData = $data['billingData'] ?? [];

        // Normalize card expiry format
        $normalizedCardDetails = XmlApiUtils::normalizeCardExpiry($cardDetails);

        // Generate unique references
        $timestampMs = (int)(microtime(true) * 1000);
        $timestampStr = (string)$timestampMs;
        $payerRef = 'CUS' . substr($timestampStr, -10);
        $paymentMethodRef = 'PMT' . substr($timestampStr, -10);
        $scheduleRef = substr($timestampStr, -13);

        // Step 1: Create or update customer
        $customerResult = self::createOrUpdateCustomer($config, [
            'payerRef' => $payerRef,
            'firstName' => $customerData['first_name'] ?? '',
            'lastName' => $customerData['last_name'] ?? '',
            'email' => $customerData['email'] ?? '',
            'phone' => $customerData['phone'] ?? '',
            'address' => [
                'street_address' => $customerData['street_address'] ?? $billingData['street_address'] ?? '',
                'city' => $customerData['city'] ?? $billingData['city'] ?? '',
                'state' => $customerData['state'] ?? $billingData['state'] ?? '',
                'billing_zip' => $customerData['billing_zip'] ?? $billingData['billing_zip'] ?? '',
                'country' => $customerData['country'] ?? $billingData['country'] ?? 'US'
            ]
        ]);

        // Step 2: Create card reference
        $cardResult = self::createCardReference($config, [
            'paymentMethodRef' => $paymentMethodRef,
            'payerRef' => $payerRef,
            'cardholderName' => ($customerData['first_name'] ?? '') . ' ' . ($customerData['last_name'] ?? ''),
            'cardDetails' => $normalizedCardDetails
        ]);

        // Step 3: Process initial payment
        $initialPaymentResult = self::storePaymentMethodWithInitialPayment($config, [
            'paymentMethodRef' => $paymentMethodRef,
            'payerRef' => $payerRef,
            'amount' => $amount,
            'currency' => $currency,
            'billingData' => $billingData,
            'customerData' => $customerData
        ]);

        // Step 4: Create recurring schedule
        $scheduleResult = self::createRecurringSchedule($config, [
            'scheduleRef' => $scheduleRef,
            'payerRef' => $payerRef,
            'paymentMethodRef' => $paymentMethodRef,
            'amount' => $amount,
            'currency' => $currency,
            'frequency' => $frequency,
            'startDate' => $startDate
        ]);

        // Return complete result
        return [
            'success' => true,
            'message' => 'Recurring payment setup completed successfully',
            'customer' => [
                'payerRef' => $customerResult['payerRef'],
                'name' => ($customerData['first_name'] ?? '') . ' ' . ($customerData['last_name'] ?? ''),
                'email' => $customerData['email'] ?? ''
            ],
            'payment' => [
                'transactionId' => $initialPaymentResult['transactionId'],
                'orderId' => $initialPaymentResult['orderId'],
                'authCode' => $initialPaymentResult['authCode'],
                'amount' => $initialPaymentResult['amount'],
                'currency' => $initialPaymentResult['currency']
            ],
            'schedule' => [
                'scheduleRef' => $scheduleResult['scheduleRef'],
                'scheduleText' => $scheduleResult['scheduleText'],
                'frequency' => $scheduleResult['frequency'],
                'startDate' => $scheduleResult['startDate'],
                'amount' => $scheduleResult['amount'],
                'currency' => $scheduleResult['currency']
            ],
            'paymentMethodRef' => $paymentMethodRef,
            'timestamp' => date('c')
        ];
    }
}
