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