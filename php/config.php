<?php

declare(strict_types=1);

/**
 * Configuration Endpoint
 *
 * Note: This file is not used for XML API implementation
 * XML API does not use client-side tokenization or public API keys
 * Card data is handled directly server-side via XML API requests
 *
 * PHP version 7.4 or higher
 *
 * @category  Configuration
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 * @link      https://github.com/globalpayments
 */

header('Content-Type: application/json');

// XML API does not use public API keys
echo json_encode([
    'success' => true,
    'message' => 'XML API does not require client-side configuration',
]);
