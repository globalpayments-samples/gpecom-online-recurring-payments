/**
 * Global Payments XML API Utilities
 *
 * This module provides utility functions for XML API integration including:
 * - SHA-1 hash generation for request authentication
 * - Timestamp formatting
 * - XML request building
 * - XML response parsing
 */

import crypto from 'crypto';
import { parseString, Builder } from 'xml2js';

/**
 * Generate timestamp in XML API format: YYYYMMDDHHMMSS
 * @returns {string} Formatted timestamp
 */
export function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Generate unique order ID
 * @param {string} prefix - Optional prefix for order ID
 * @returns {string} Unique order ID
 */
export function generateOrderId(prefix = 'ORD') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate SHA-1 hash for XML API authentication
 * XML API uses a two-step hashing process:
 * 1. Hash the concatenated request values
 * 2. Hash the result with the shared secret appended
 *
 * @param {string} dataString - Concatenated request values (e.g., "timestamp.merchantid.orderid.amount.currency.cardnumber")
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {string} SHA-1 hash for authentication
 */
export function generateSHA1Hash(dataString, sharedSecret) {
    // Step 1: Hash the data string
    const firstHash = crypto
        .createHash('sha1')
        .update(dataString)
        .digest('hex');

    // Step 2: Concatenate first hash with shared secret and hash again
    const secondHash = crypto
        .createHash('sha1')
        .update(`${firstHash}.${sharedSecret}`)
        .digest('hex');

    return secondHash;
}

/**
 * Generate authentication hash for payment request
 * Hash blueprint: timestamp.merchantid.orderid.amount.currency.cardnumber
 *
 * @param {Object} params - Request parameters
 * @param {string} params.timestamp - Request timestamp
 * @param {string} params.merchantId - Merchant ID
 * @param {string} params.orderId - Order ID
 * @param {string} params.amount - Amount in smallest currency unit (e.g., cents)
 * @param {string} params.currency - Currency code (e.g., 'USD')
 * @param {string} params.cardNumber - Card number (optional, empty string for token-based)
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {string} Authentication hash
 */
export function generatePaymentHash(params, sharedSecret) {
    const { timestamp, merchantId, orderId, amount, currency, cardNumber = '' } = params;
    const dataString = `${timestamp}.${merchantId}.${orderId}.${amount}.${currency}.${cardNumber}`;
    return generateSHA1Hash(dataString, sharedSecret);
}

/**
 * Generate authentication hash for stored card payment (receipt-in)
 * Hash blueprint: timestamp.merchantid.orderid.amount.currency.payerref
 *
 * @param {Object} params - Request parameters
 * @param {string} params.timestamp - Request timestamp
 * @param {string} params.merchantId - Merchant ID
 * @param {string} params.orderId - Order ID
 * @param {string} params.amount - Amount in smallest currency unit
 * @param {string} params.currency - Currency code
 * @param {string} params.payerRef - Customer/payer reference
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {string} Authentication hash
 */
export function generateStoredCardPaymentHash(params, sharedSecret) {
    const { timestamp, merchantId, orderId, amount, currency, payerRef } = params;
    const dataString = `${timestamp}.${merchantId}.${orderId}.${amount}.${currency}.${payerRef}`;
    return generateSHA1Hash(dataString, sharedSecret);
}

/**
 * Generate authentication hash for card storage operations
 * Hash blueprint: timestamp.merchantid.orderid.amount.currency.payerref
 *
 * @param {Object} params - Request parameters
 * @param {string} params.timestamp - Request timestamp
 * @param {string} params.merchantId - Merchant ID
 * @param {string} params.orderId - Order ID
 * @param {string} params.amount - Amount (use empty string for storage without payment)
 * @param {string} params.currency - Currency (use empty string for storage without payment)
 * @param {string} params.payerRef - Customer/payer reference
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {string} Authentication hash
 */
export function generateCardStorageHash(params, sharedSecret) {
    const { timestamp, merchantId, orderId, amount = '', currency = '', payerRef } = params;
    const dataString = `${timestamp}.${merchantId}.${orderId}.${amount}.${currency}.${payerRef}`;
    return generateSHA1Hash(dataString, sharedSecret);
}

/**
 * Generate authentication hash for Payment Scheduler operations
 * Hash blueprint: timestamp.merchantid.scheduleref.amount.currency.payerref.schedule
 *
 * @param {Object} params - Request parameters
 * @param {string} params.timestamp - Request timestamp
 * @param {string} params.merchantId - Merchant ID
 * @param {string} params.scheduleRef - Schedule reference
 * @param {string} params.amount - Amount in smallest currency unit
 * @param {string} params.currency - Currency code
 * @param {string} params.payerRef - Customer/payer reference
 * @param {string} params.schedule - Schedule frequency (e.g., 'monthly', 'weekly')
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {string} Authentication hash
 */
export function generateScheduleHash(params, sharedSecret) {
    const { timestamp, merchantId, scheduleRef, amount, currency, payerRef, schedule } = params;
    const dataString = `${timestamp}.${merchantId}.${scheduleRef}.${amount}.${currency}.${payerRef}.${schedule}`;
    return generateSHA1Hash(dataString, sharedSecret);
}

/**
 * Verify response hash from XML API
 * Response hash blueprint: timestamp.merchantid.orderid.result.message.pasref.authcode
 *
 * @param {Object} response - Response object from XML API
 * @param {string} sharedSecret - Merchant shared secret
 * @returns {boolean} True if hash is valid
 */
export function verifyResponseHash(response, sharedSecret) {
    const { timestamp, merchantid, orderid, result, message, pasref = '', authcode = '' } = response;
    const dataString = `${timestamp}.${merchantid}.${orderid}.${result}.${message}.${pasref}.${authcode}`;
    const calculatedHash = generateSHA1Hash(dataString, sharedSecret);

    return calculatedHash === response.sha1hash;
}

/**
 * Convert amount to smallest currency unit (cents)
 * XML API requires amounts without decimal points
 *
 * @param {number} amount - Amount in dollars (e.g., 29.99)
 * @returns {string} Amount in cents (e.g., '2999')
 */
export function convertToCents(amount) {
    return String(Math.round(amount * 100));
}

/**
 * Convert amount from smallest currency unit to dollars
 *
 * @param {string|number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
export function convertFromCents(cents) {
    return Number(cents) / 100;
}

/**
 * Sanitize postal code for XML API
 * Allowed characters: alphanumeric, hyphen, space
 *
 * @param {string} postalCode - Postal code to sanitize
 * @returns {string} Sanitized postal code
 */
export function sanitizePostalCode(postalCode) {
    if (!postalCode) return '';
    return postalCode.replace(/[^a-zA-Z0-9- ]/g, '').slice(0, 10);
}

/**
 * Sanitize alphanumeric fields for XML API
 * Allowed characters: alphanumeric, /.-_', and space
 *
 * @param {string} value - Value to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized value
 */
export function sanitizeAlphanumeric(value, maxLength = 255) {
    if (!value) return '';
    return value.replace(/[^a-zA-Z0-9\/.\-_', ]/g, '').slice(0, maxLength);
}

/**
 * Parse XML response from XML API
 *
 * @param {string} xmlString - XML response string
 * @returns {Promise<Object>} Parsed response object
 */
export async function parseXMLResponse(xmlString) {
    return new Promise((resolve, reject) => {
        parseString(xmlString, { explicitArray: false, mergeAttrs: true }, (err, result) => {
            if (err) {
                reject(new Error(`XML parsing error: ${err.message}`));
            } else {
                resolve(result.response);
            }
        });
    });
}

/**
 * Build XML request for XML API
 *
 * @param {Object} requestData - Request data object
 * @returns {string} XML request string
 */
export function buildXMLRequest(requestData) {
    const builder = new Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: false }
    });

    return builder.buildObject({ request: requestData });
}

/**
 * Map frequency string to XML API schedule format
 *
 * @param {string} frequency - Frequency (weekly, bi-weekly, monthly, quarterly, yearly)
 * @returns {string} XML API schedule macro
 */
export function mapFrequencyToSchedule(frequency) {
    const frequencyMap = {
        'weekly': 'weekly',
        'bi-weekly': '? * 6',  // Every Saturday (cron format)
        'biweekly': '? * 6',
        'monthly': 'monthly',
        'quarterly': 'quarterly',
        'yearly': 'yearly',
        'annually': 'yearly'
    };

    return frequencyMap[frequency.toLowerCase()] || 'monthly';
}

/**
 * Format start date for XML API (YYYYMMDD)
 *
 * @param {string|Date} date - Start date (ISO string or Date object)
 * @returns {string} Formatted date (YYYYMMDD)
 */
export function formatStartDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}

/**
 * Get XML API endpoint URL based on environment
 *
 * @param {string} environment - 'sandbox' or 'production'
 * @returns {string} XML API endpoint URL
 */
export function getXMLAPIEndpoint(environment = 'sandbox') {
    return environment === 'production'
        ? 'https://api.realexpayments.com/epage-remote.cgi'
        : 'https://api.sandbox.realexpayments.com/epage-remote.cgi';
}

/**
 * Parse XML API error response
 *
 * @param {Object} response - Parsed XML API response
 * @returns {Object} Error information
 */
export function parseErrorResponse(response) {
    return {
        result: response.result,
        message: response.message || 'Unknown error',
        timestamp: response.timestamp,
        orderId: response.orderid
    };
}
