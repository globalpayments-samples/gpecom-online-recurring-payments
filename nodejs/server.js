/**
 * Global Payments XML API - Recurring Payments Server
 *
 * This Express application implements recurring payments using the Global Payments XML API.
 * Features:
 * - One-time payment processing
 * - Recurring payment setup with Payment Scheduler
 * - Customer and payment method storage
 * - StoredCredential implementation for recurring transactions
 * - Support for multiple billing frequencies (weekly, bi-weekly, monthly, quarterly, yearly)
 */

import express from 'express';
import * as dotenv from 'dotenv';
import {
    processOneTimePayment,
    processRecurringPaymentSetup
} from './paymentUtils.js';
import {
    generateTimestamp,
    generateOrderId,
    generateHPPHash,
    generateHPPResponseHash,
    convertToCents
} from './xmlApiUtils.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Initialize Express application with necessary middleware
 */
const app = express();
const port = process.env.PORT || 8000;

app.use(express.static('.')); // Serve static files (index.html, etc.)
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.json()); // Parse JSON requests

/**
 * Get XML API configuration from environment variables
 */
function getXMLAPIConfig() {
    return {
        merchantId: process.env.MERCHANT_ID,
        sharedSecret: process.env.SHARED_SECRET,
        account: process.env.ACCOUNT || 'internet',
        environment: process.env.XML_API_ENVIRONMENT || 'sandbox'
    };
}

/**
 * Validate required environment variables
 */
function validateConfig() {
    const config = getXMLAPIConfig();
    const missing = [];

    if (!config.merchantId) missing.push('MERCHANT_ID');
    if (!config.sharedSecret) missing.push('SHARED_SECRET');

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return config;
}

/**
 * Send standardized success response
 */
function sendSuccessResponse(res, data, message = 'Success') {
    res.json({
        success: true,
        data: data,
        message: message,
        timestamp: new Date().toISOString()
    });
}

/**
 * Send standardized error response
 */
function sendErrorResponse(res, statusCode, message, errorCode = 'ERROR') {
    res.status(statusCode).json({
        success: false,
        message: message,
        error_code: errorCode,
        timestamp: new Date().toISOString()
    });
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    try {
        validateConfig();
        res.json({
            status: 'healthy',
            environment: process.env.XML_API_ENVIRONMENT || 'sandbox',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Config endpoint - provides configuration for client-side
 * For XML API, the client-side will use RealEx HPP or direct card input
 * This endpoint returns merchant ID and environment for client SDK initialization
 */
app.get('/config', async (req, res) => {
    try {
        const config = validateConfig();

        sendSuccessResponse(res, {
            merchantId: config.merchantId,
            environment: config.environment,
            // Note: NEVER send the shared secret to the client
            // The shared secret must remain server-side only
        }, 'Configuration retrieved successfully');
    } catch (error) {
        console.error('Config error:', error.message);
        sendErrorResponse(res, 500, `Error loading configuration: ${error.message}`, 'CONFIG_ERROR');
    }
});

/**
 * Generate HPP request endpoint
 * Creates the JSON request for the Hosted Payment Page
 *
 * Request body parameters:
 * - amount (number, required): Payment amount in dollars
 * - currency (string, optional): Currency code (default: 'USD')
 * - customer_email (string, optional): Customer email
 * - customer_phone (string, optional): Customer phone
 * - billing_* (string, optional): Billing address fields
 * - shipping_* (string, optional): Shipping address fields
 */
app.post('/hpp-request', async (req, res) => {
    try {
        const config = validateConfig();
        const {
            amount,
            currency = 'USD',
            customer_email,
            customer_phone,
            billing_street1,
            billing_street2,
            billing_street3,
            billing_city,
            billing_postalcode,
            billing_country,
            shipping_street1,
            shipping_street2,
            shipping_street3,
            shipping_city,
            shipping_state,
            shipping_postalcode,
            shipping_country
        } = req.body;

        // Validate required fields
        if (!amount || amount <= 0) {
            return sendErrorResponse(res, 400, 'Valid amount is required', 'INVALID_AMOUNT');
        }

        // Generate request parameters
        const timestamp = generateTimestamp();
        const orderId = generateOrderId('HPP');
        const amountInCents = convertToCents(amount);

        // Generate hash
        const hash = generateHPPHash({
            timestamp,
            merchantId: config.merchantId,
            orderId,
            amount: amountInCents,
            currency
        }, config.sharedSecret);

        // Build HPP request JSON
        const hppRequest = {
            TIMESTAMP: timestamp,
            MERCHANT_ID: config.merchantId,
            ACCOUNT: config.account,
            ORDER_ID: orderId,
            AMOUNT: amountInCents,
            CURRENCY: currency,
            AUTO_SETTLE_FLAG: '1',
            HPP_VERSION: '2',
            HPP_CHANNEL: 'ECOM',
            MERCHANT_RESPONSE_URL: `${req.protocol}://${req.get('host')}/hpp-response`,
            SHA1HASH: hash
        };

        // Add optional customer fields
        if (customer_email) {
            hppRequest.HPP_CUSTOMER_EMAIL = customer_email;
        }
        if (customer_phone) {
            hppRequest.HPP_CUSTOMER_PHONENUMBER_MOBILE = customer_phone;
        }

        // Add billing address fields
        if (billing_street1) hppRequest.HPP_BILLING_STREET1 = billing_street1;
        if (billing_street2) hppRequest.HPP_BILLING_STREET2 = billing_street2;
        if (billing_street3) hppRequest.HPP_BILLING_STREET3 = billing_street3;
        if (billing_city) hppRequest.HPP_BILLING_CITY = billing_city;
        if (billing_postalcode) hppRequest.HPP_BILLING_POSTALCODE = billing_postalcode;
        if (billing_country) hppRequest.HPP_BILLING_COUNTRY = billing_country;

        // Add shipping address fields
        if (shipping_street1) hppRequest.HPP_SHIPPING_STREET1 = shipping_street1;
        if (shipping_street2) hppRequest.HPP_SHIPPING_STREET2 = shipping_street2;
        if (shipping_street3) hppRequest.HPP_SHIPPING_STREET3 = shipping_street3;
        if (shipping_city) hppRequest.HPP_SHIPPING_CITY = shipping_city;
        if (shipping_state) hppRequest.HPP_SHIPPING_STATE = shipping_state;
        if (shipping_postalcode) hppRequest.HPP_SHIPPING_POSTALCODE = shipping_postalcode;
        if (shipping_country) hppRequest.HPP_SHIPPING_COUNTRY = shipping_country;

        sendSuccessResponse(res, hppRequest, 'HPP request generated successfully');

    } catch (error) {
        console.error('HPP request generation error:', error.message);
        sendErrorResponse(res, 500, error.message, 'HPP_REQUEST_ERROR');
    }
});

/**
 * Process HPP response endpoint
 * Handles the response from the Hosted Payment Page
 */
app.post('/hpp-response', async (req, res) => {
    try {
        const config = validateConfig();
        const response = req.body;

        console.log('📥 HPP Response received:', response);

        // Extract response parameters
        const {
            TIMESTAMP,
            MERCHANT_ID,
            ORDER_ID,
            RESULT,
            MESSAGE,
            PASREF,
            AUTHCODE = '',
            SHA1HASH
        } = response;

        // Verify hash
        const expectedHash = generateHPPResponseHash({
            timestamp: TIMESTAMP,
            merchantId: MERCHANT_ID,
            orderId: ORDER_ID,
            result: RESULT,
            message: MESSAGE,
            pasref: PASREF,
            authcode: AUTHCODE
        }, config.sharedSecret);

        if (expectedHash.toLowerCase() !== SHA1HASH.toLowerCase()) {
            console.error('❌ HPP Response hash verification failed');
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Payment Failed</title></head>
                <body>
                    <h1>Payment Verification Failed</h1>
                    <p>The payment response could not be verified. Please contact support.</p>
                </body>
                </html>
            `);
        }

        // Check result
        if (RESULT === '00') {
            // Success
            console.log('✅ HPP Payment successful');
            res.send(`
                <!DOCTYPE html>
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
                        <p><strong>Order ID:</strong> ${ORDER_ID}</p>
                        <p><strong>Transaction ID:</strong> ${PASREF}</p>
                        <p><strong>Authorization Code:</strong> ${AUTHCODE}</p>
                        <p><strong>Amount:</strong> ${response.AMOUNT} ${response.CURRENCY}</p>
                    </div>
                    <p>${MESSAGE}</p>
                    <button onclick="window.close()">Close Window</button>
                </body>
                </html>
            `);
        } else {
            // Failed
            console.log('❌ HPP Payment failed:', MESSAGE);
            res.send(`
                <!DOCTYPE html>
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
                        <p><strong>Order ID:</strong> ${ORDER_ID}</p>
                        <p><strong>Error Code:</strong> ${RESULT}</p>
                    </div>
                    <p>${MESSAGE}</p>
                    <button onclick="window.close()">Close Window</button>
                </body>
                </html>
            `);
        }

    } catch (error) {
        console.error('HPP response processing error:', error.message);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <h1>Error Processing Payment Response</h1>
                <p>${error.message}</p>
            </body>
            </html>
        `);
    }
});

/**
 * Recurring payment setup endpoint
 * Handles the complete recurring payment setup workflow
 */
app.post('/recurring-setup', async (req, res) => {
    try {
        const config = validateConfig();
        const data = req.body;

        console.log('Processing recurring payment setup...');

        // Process complete recurring payment setup
        const result = await processRecurringPaymentSetup(config, data);

        sendSuccessResponse(res, result, 'Recurring payment setup completed successfully');

    } catch (error) {
        console.error('Recurring payment setup error:', error.message);
        sendErrorResponse(res, 500, error.message, 'RECURRING_SETUP_ERROR');
    }
});

/**
 * Process payment endpoint
 * Handles both one-time and recurring payments
 *
 * Request body parameters:
 * - payment_token (string, required): Token from client-side tokenization
 * - amount (number, required): Payment amount in dollars
 * - currency (string, optional): Currency code (default: 'USD')
 * - is_recurring (boolean, optional): Whether this is a recurring payment setup
 *
 * For recurring payments, also required:
 * - frequency (string): 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly'
 * - start_date (string): Start date in ISO format
 * - first_name, last_name, email, phone (string): Customer information
 * - billing_zip, city, state, country (string): Address information
 */
app.post('/process-payment', async (req, res) => {
    try {
        const config = validateConfig();

        // Extract request parameters
        const {
            payment_token,
            amount,
            currency = 'USD',
            is_recurring = false,
            frequency,
            start_date,
            // Customer data
            first_name,
            last_name,
            email,
            phone,
            // Billing data
            billing_zip,
            street_address,
            city,
            state,
            country = 'US'
        } = req.body;

        // Validate required fields
        if (!payment_token) {
            return sendErrorResponse(res, 400, 'Payment token is required', 'MISSING_TOKEN');
        }

        if (!amount || amount <= 0) {
            return sendErrorResponse(res, 400, 'Valid amount is required', 'INVALID_AMOUNT');
        }

        // Prepare billing data
        const billingData = {
            billing_zip,
            street_address,
            city,
            state,
            country
        };

        // Prepare customer data
        const customerData = {
            first_name,
            last_name,
            email,
            phone,
            billing_zip,
            city,
            state,
            country,
            street_address
        };

        // Process recurring payment setup
        if (is_recurring) {
            // Validate recurring payment fields
            if (!frequency) {
                return sendErrorResponse(res, 400, 'Frequency is required for recurring payments', 'MISSING_FREQUENCY');
            }

            if (!start_date) {
                return sendErrorResponse(res, 400, 'Start date is required for recurring payments', 'MISSING_START_DATE');
            }

            if (!first_name || !last_name || !email) {
                return sendErrorResponse(res, 400, 'Customer information (first_name, last_name, email) is required for recurring payments', 'MISSING_CUSTOMER_INFO');
            }

            // Validate frequency
            const validFrequencies = ['weekly', 'bi-weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'annually'];
            if (!validFrequencies.includes(frequency.toLowerCase())) {
                return sendErrorResponse(res, 400, `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`, 'INVALID_FREQUENCY');
            }

            console.log(`Processing recurring payment setup: ${frequency} starting ${start_date}`);

            // Process complete recurring payment setup
            const result = await processRecurringPaymentSetup(config, {
                token: payment_token,
                amount,
                currency,
                frequency,
                startDate: start_date,
                customerData,
                billingData
            });

            sendSuccessResponse(res, result, 'Recurring payment schedule created successfully');

        } else {
            // Process one-time payment
            console.log(`Processing one-time payment: ${amount} ${currency}`);

            const result = await processOneTimePayment(config, {
                token: payment_token,
                amount,
                currency,
                billingData,
                customerData
            });

            sendSuccessResponse(res, result, 'Payment processed successfully');
        }

    } catch (error) {
        console.error('Payment processing error:', error.message);

        // Determine appropriate error code based on error message
        let errorCode = 'PAYMENT_ERROR';
        let statusCode = 500;

        if (error.message.includes('Authentication') || error.message.includes('hash')) {
            errorCode = 'AUTH_ERROR';
            statusCode = 401;
        } else if (error.message.includes('declined') || error.message.includes('insufficient')) {
            errorCode = 'DECLINED';
            statusCode = 402;
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
            errorCode = 'INVALID_REQUEST';
            statusCode = 400;
        }

        sendErrorResponse(res, statusCode, error.message, errorCode);
    }
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    sendErrorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR');
});

/**
 * 404 handler
 */
app.use((req, res) => {
    sendErrorResponse(res, 404, 'Endpoint not found', 'NOT_FOUND');
});

/**
 * Start the server
 */
try {
    // Validate configuration on startup
    const config = validateConfig();

    app.listen(port, '0.0.0.0', () => {
        console.log('='.repeat(60));
        console.log('Global Payments XML API - Recurring Payments Server');
        console.log('='.repeat(60));
        console.log(`Server running at: http://localhost:${port}`);
        console.log(`Environment: ${config.environment}`);
        console.log(`Merchant ID: ${config.merchantId}`);
        console.log('');
        console.log('Available endpoints:');
        console.log('  GET  /health           - Health check');
        console.log('  GET  /config           - Get configuration');
        console.log('  POST /process-payment  - Process payment or setup recurring');
        console.log('');
        console.log('Features:');
        console.log('  ✓ One-time payments');
        console.log('  ✓ Recurring/subscription payments');
        console.log('  ✓ Customer and payment method storage');
        console.log('  ✓ Payment Scheduler integration');
        console.log('  ✓ StoredCredential for recurring transactions');
        console.log('  ✓ Multiple frequencies: weekly, bi-weekly, monthly, quarterly, yearly');
        console.log('='.repeat(60));
    });
} catch (error) {
    console.error('❌ Server startup failed:', error.message);
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('Required: MERCHANT_ID, SHARED_SECRET');
    process.exit(1);
}