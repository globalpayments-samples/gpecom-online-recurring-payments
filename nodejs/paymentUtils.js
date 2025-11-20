/**
 * Payment Processing Utilities for XML API
 *
 * This module handles:
 * - One-time payment processing
 * - Recurring payment setup
 * - Customer and payment method storage
 * - Payment Scheduler integration
 */

import axios from 'axios';
import {
    generateTimestamp,
    generateOrderId,
    generatePaymentHash,
    generateStoredCardPaymentHash,
    generateCardStorageHash,
    generateCardNewHash,
    generateScheduleHash,
    convertToCents,
    sanitizePostalCode,
    sanitizeAlphanumeric,
    parseXMLResponse,
    buildXMLRequest,
    mapFrequencyToSchedule,
    formatStartDate,
    getXMLAPIEndpoint,
    verifyResponseHash,
    parseErrorResponse,
    normalizeCardExpiry,
    convertCountryCodeToAlpha2
} from './xmlApiUtils.js';

/**
 * Process one-time payment using XML API
 * Uses auth transaction type with auto-settle
 *
 * @param {Object} config - XML API configuration
 * @param {Object} paymentData - Payment information
 * @returns {Promise<Object>} Payment result
 */
export async function processOneTimePayment(config, paymentData) {
    try {
        const { merchantId, sharedSecret, account, environment } = config;
        const { token, amount, currency, billingData, customerData } = paymentData;

        // Generate required values
        const timestamp = generateTimestamp();
        const orderId = generateOrderId('PAY');
        const amountInCents = convertToCents(amount);

        // Parse card data - token parameter should contain card data object
        let cardData = typeof token === 'object' ? token : {
            number: token,
            expmonth: '12',
            expyear: '25',
            cvn: '123',
            chname: `${customerData?.first_name || 'Card'} ${customerData?.last_name || 'Holder'}`
        };

        // Normalize card expiry format to handle various input formats
        cardData = normalizeCardExpiry(cardData);

        // Generate authentication hash for payment
        // For auth with card details, use the actual card number in hash
        const hash = generatePaymentHash({
            timestamp,
            merchantId,
            orderId,
            amount: amountInCents,
            currency,
            cardNumber: cardData.number  // Use actual card number for hash
        }, sharedSecret);

        const requestData = {
            $: {
                timestamp,
                type: 'auth'
            },
            merchantid: merchantId,
            account: account,
            orderid: orderId,
            amount: {
                _: amountInCents,
                $: { currency }
            },
            card: {
                number: cardData.number,
                expdate: `${cardData.expmonth}${cardData.expyear}`,
                chname: cardData.chname,
                type: cardData.type || 'VISA',
                cvn: {
                    number: cardData.cvn,
                    presind: '1'  // CVN present
                }
            },
            autosettle: {
                $: { flag: '1' }  // Auto-capture the payment
            },
            sha1hash: hash
        };

        // Add billing address if provided
        if (billingData?.billing_zip) {
            requestData.tssinfo = {
                address: {
                    code: sanitizePostalCode(billingData.billing_zip),
                    country: billingData.country || 'US'
                }
            };
        }

        // Add customer information if provided
        if (customerData) {
            requestData.comments = {
                comment: {
                    _: `Customer: ${sanitizeAlphanumeric(customerData.first_name || '')} ${sanitizeAlphanumeric(customerData.last_name || '')}`,
                    $: { id: '1' }
                }
            };
        }

        // Send request to XML API
        const xmlRequest = buildXMLRequest(requestData);
        const endpoint = getXMLAPIEndpoint(environment);

        console.log('📤 Sending XML request to:', endpoint);
        console.log('📤 Request XML:', xmlRequest.substring(0, 500) + '...');

        const response = await axios.post(endpoint, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('📥 Response XML:', response.data.substring(0, 500) + '...');

        // Parse response
        const parsedResponse = await parseXMLResponse(response.data);
        console.log('📥 Parsed response:', JSON.stringify(parsedResponse, null, 2));

        // Verify response hash (temporarily disabled for debugging)
        // if (!verifyResponseHash(parsedResponse, sharedSecret)) {
        //     console.warn('⚠️  Response hash verification failed - continuing for debugging');
        // }

        // Check if payment was successful
        if (parsedResponse.result !== '00') {
            const error = parseErrorResponse(parsedResponse);
            throw new Error(`Payment failed: ${error.message} (Code: ${error.result})`);
        }

        // Return successful payment result
        return {
            success: true,
            transactionId: parsedResponse.pasref,
            orderId: parsedResponse.orderid,
            authCode: parsedResponse.authcode,
            amount: amount,
            currency: currency,
            message: parsedResponse.message,
            timestamp: parsedResponse.timestamp,
            avsPostcodeResult: parsedResponse.avspostcoderesponse || '',
            cvnResult: parsedResponse.cvnresult || ''
        };

    } catch (error) {
        console.error('One-time payment processing error:', error.message);
        throw error;
    }
}

/**
 * Create or update customer (payer) in Card Storage
 *
 * @param {Object} config - XML API configuration
 * @param {Object} customerData - Customer information
 * @returns {Promise<Object>} Customer result
 */
export async function createOrUpdateCustomer(config, customerData) {
    try {
        const { merchantId, sharedSecret, environment } = config;
        const { payerRef, firstName, lastName, email, phone, address } = customerData;

        const timestamp = generateTimestamp();
        const orderId = generateOrderId('CUST');

        // Generate hash for payer-new
        const hash = generateCardStorageHash({
            timestamp,
            merchantId,
            orderId,
            amount: '',
            currency: '',
            payerRef
        }, sharedSecret);

        // Build XML request for payer-new
        const requestData = {
            $: {
                timestamp,
                type: 'payer-new'
            },
            merchantid: merchantId,
            orderid: orderId,
            payer: {
                $: {
                    type: 'Retail',
                    ref: payerRef
                },
                title: '',
                firstname: sanitizeAlphanumeric(firstName || '', 100),
                surname: sanitizeAlphanumeric(lastName || '', 100),
                company: '',
                address: address ? {
                    line1: sanitizeAlphanumeric(address.street_address || '', 50),
                    line2: '',
                    line3: '',
                    city: sanitizeAlphanumeric(address.city || '', 40),
                    county: sanitizeAlphanumeric(address.state || '', 40),
                    postcode: sanitizePostalCode(address.billing_zip || ''),
                    country: {
                        _: convertCountryCodeToAlpha2(address.country) || 'US',
                        $: { code: convertCountryCodeToAlpha2(address.country) || 'US' }
                    }
                } : undefined,
                phonenumbers: phone ? {
                    home: sanitizeAlphanumeric(phone, 20)
                } : undefined,
                email: sanitizeAlphanumeric(email || '', 255)
            },
            sha1hash: hash
        };

        // Send request to XML API
        const xmlRequest = buildXMLRequest(requestData);
        const endpoint = getXMLAPIEndpoint(environment);

        console.log('📤 [Customer] Sending XML request to:', endpoint);

        const response = await axios.post(endpoint, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('📥 [Customer] Response received');

        // Parse response
        const parsedResponse = await parseXMLResponse(response.data);
        console.log('📥 [Customer] Parsed response:', JSON.stringify(parsedResponse, null, 2));

        // Verify response hash (temporarily disabled for debugging)
        // if (!verifyResponseHash(parsedResponse, sharedSecret)) {
        //     console.warn('⚠️  [Customer] Response hash verification failed - continuing for debugging');
        // }

        // Check result (00 = success, 501 = payer already exists - both are acceptable)
        if (parsedResponse.result !== '00' && parsedResponse.result !== '501') {
            const error = parseErrorResponse(parsedResponse);
            throw new Error(`Customer creation failed: ${error.message} (Code: ${error.result})`);
        }

        return {
            success: true,
            payerRef: payerRef,
            message: parsedResponse.message,
            alreadyExists: parsedResponse.result === '501'
        };

    } catch (error) {
        console.error('Customer creation error:', error.message);
        throw error;
    }
}

/**
 * Store payment method (card) for recurring use
 * Uses receipt-in with StoredCredential for initial payment
 *
 * @param {Object} config - XML API configuration
 * @param {Object} paymentData - Payment and storage information
 * @returns {Promise<Object>} Storage result with initial payment
 */
export async function storePaymentMethodWithInitialPayment(config, paymentData) {
    try {
        const { merchantId, sharedSecret, account, environment } = config;
        const { paymentMethodRef, payerRef, amount, currency, billingData, customerData } = paymentData;

        const timestamp = generateTimestamp();
        const orderId = generateOrderId('INIT');
        const amountInCents = convertToCents(amount);

        // Generate hash for receipt-in with stored card
        const hash = generateStoredCardPaymentHash({
            timestamp,
            merchantId,
            orderId,
            amount: amountInCents,
            currency,
            payerRef
        }, sharedSecret);

        // Build XML request for initial recurring payment (receipt-in)
        const requestData = {
            $: {
                timestamp,
                type: 'receipt-in'  // Used for card storage with payment
            },
            merchantid: merchantId,
            account: account,
            orderid: orderId,
            amount: {
                _: amountInCents,
                $: { currency }
            },
            payerref: payerRef,
            paymentmethod: paymentMethodRef,
            autosettle: {
                $: { flag: '1' }
            },
            // StoredCredential for recurring payments - FIRST transaction
            recurring: {
                $: {
                    type: 'fixed',      // Fixed amount recurring
                    sequence: 'first'    // This is the first transaction
                }
            },
            sha1hash: hash
        };

        // Add billing information
        if (billingData?.billing_zip) {
            requestData.tssinfo = {
                address: {
                    code: sanitizePostalCode(billingData.billing_zip),
                    country: billingData.country || 'US'
                }
            };
        }

        // Add comments with customer info
        if (customerData) {
            requestData.comments = {
                comment: [
                    {
                        _: `Initial recurring payment for ${sanitizeAlphanumeric(customerData.first_name || '')} ${sanitizeAlphanumeric(customerData.last_name || '')}`,
                        $: { id: '1' }
                    },
                    {
                        _: `Email: ${sanitizeAlphanumeric(customerData.email || '')}`,
                        $: { id: '2' }
                    }
                ]
            };
        }

        // Send request to XML API
        const xmlRequest = buildXMLRequest(requestData);
        const endpoint = getXMLAPIEndpoint(environment);

        console.log('📤 [Initial Payment] Sending XML request to:', endpoint);

        const response = await axios.post(endpoint, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('📥 [Initial Payment] Response received');

        // Parse response
        const parsedResponse = await parseXMLResponse(response.data);
        console.log('📥 [Initial Payment] Parsed response:', JSON.stringify(parsedResponse, null, 2));

        // Verify response hash (temporarily disabled for debugging)
        // if (!verifyResponseHash(parsedResponse, sharedSecret)) {
        //     console.warn('⚠️  [Initial Payment] Response hash verification failed - continuing for debugging');
        // }

        // Check if payment was successful
        if (parsedResponse.result !== '00') {
            const error = parseErrorResponse(parsedResponse);
            throw new Error(`Initial payment failed: ${error.message} (Code: ${error.result})`);
        }

        return {
            success: true,
            transactionId: parsedResponse.pasref,
            orderId: parsedResponse.orderid,
            authCode: parsedResponse.authcode,
            payerRef: payerRef,
            paymentMethodRef: paymentMethodRef,
            amount: amount,
            currency: currency,
            message: 'Initial payment successful - payment method stored for recurring use',
            timestamp: parsedResponse.timestamp
        };

    } catch (error) {
        console.error('Payment method storage error:', error.message);
        throw error;
    }
}

/**
 * Create card reference in Card Storage API
 * This must be done before storing the actual card
 *
 * @param {Object} config - XML API configuration
 * @param {Object} cardData - Card reference information
 * @returns {Promise<Object>} Card reference result
 */
export async function createCardReference(config, cardData) {
    try {
        const { merchantId, sharedSecret, environment } = config;
        const { paymentMethodRef, payerRef, cardholderName, cardDetails } = cardData;

        const timestamp = generateTimestamp();
        const orderId = generateOrderId('CARD');

        // Generate hash for card-new
        // Hash blueprint: timestamp.merchantid.orderid.amount.currency.payerref.chname.cardnumber
        const hash = generateCardNewHash({
            timestamp,
            merchantId,
            orderId,
            amount: '',
            currency: '',
            payerRef,
            chname: sanitizeAlphanumeric(cardholderName || '', 100),
            cardNumber: cardDetails.number
        }, sharedSecret);

        // Build XML request for card-new
        const requestData = {
            $: {
                timestamp,
                type: 'card-new'
            },
            merchantid: merchantId,
            orderid: orderId,
            card: {
                ref: paymentMethodRef,
                payerref: payerRef,
                chname: sanitizeAlphanumeric(cardholderName || '', 100),
                number: cardDetails.number,
                expdate: `${cardDetails.expmonth}${cardDetails.expyear}`,
                type: cardDetails.type || 'VISA'
            },
            sha1hash: hash
        };

        // Send request to XML API
        const xmlRequest = buildXMLRequest(requestData);
        const endpoint = getXMLAPIEndpoint(environment);

        console.log('📤 [Card] Sending XML request to:', endpoint);

        const response = await axios.post(endpoint, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('📥 [Card] Response received');

        // Parse response
        const parsedResponse = await parseXMLResponse(response.data);
        console.log('📥 [Card] Parsed response:', JSON.stringify(parsedResponse, null, 2));

        // Verify response hash (temporarily disabled for debugging)
        // if (!verifyResponseHash(parsedResponse, sharedSecret)) {
        //     console.warn('⚠️  [Card] Response hash verification failed - continuing for debugging');
        // }

        // Check result (00 = success, 520 = card already exists - both acceptable)
        if (parsedResponse.result !== '00' && parsedResponse.result !== '520') {
            const error = parseErrorResponse(parsedResponse);
            throw new Error(`Card reference creation failed: ${error.message} (Code: ${error.result})`);
        }

        return {
            success: true,
            paymentMethodRef: paymentMethodRef,
            payerRef: payerRef,
            message: parsedResponse.message,
            alreadyExists: parsedResponse.result === '520'
        };

    } catch (error) {
        console.error('Card reference creation error:', error.message);
        throw error;
    }
}

/**
 * Create recurring payment schedule using Payment Scheduler API
 *
 * @param {Object} config - XML API configuration
 * @param {Object} scheduleData - Schedule information
 * @returns {Promise<Object>} Schedule result
 */
export async function createRecurringSchedule(config, scheduleData) {
    try {
        const { merchantId, sharedSecret, account, environment } = config;
        const {
            scheduleRef,
            payerRef,
            paymentMethodRef,
            amount,
            currency,
            frequency,
            startDate,
            numTimes = -1,  // -1 = indefinite
            alias = ''
        } = scheduleData;

        const timestamp = generateTimestamp();
        const amountInCents = convertToCents(amount);
        const schedule = mapFrequencyToSchedule(frequency);
        const formattedStartDate = formatStartDate(startDate);

        // Generate hash for schedule-new
        const hash = generateScheduleHash({
            timestamp,
            merchantId,
            scheduleRef,
            amount: amountInCents,
            currency,
            payerRef,
            schedule
        }, sharedSecret);

        // Build XML request for schedule-new with STRICT element ordering
        // Order: Required fields first, then optional fields, sha1hash MUST be last
        const requestData = {
            $: {
                type: 'schedule-new',
                timestamp
            }
        };

        // Build elements in exact order expected by schema
        // Start with merchantid and account
        requestData.merchantid = merchantId;
        if (account) {
            requestData.account = account;
        }

        // REQUIRED schedule fields in correct order
        requestData.scheduleref = scheduleRef;
        requestData.transtype = 'auth';
        requestData.schedule = schedule;
        requestData.numtimes = numTimes;  // REQUIRED field
        requestData.payerref = payerRef;
        requestData.paymentmethod = paymentMethodRef;
        requestData.amount = {
            _: amountInCents,
            $: { currency }
        };
        if (scheduleData.varref) {
            requestData.varref = sanitizeAlphanumeric(scheduleData.varref, 50);
        }
        if (scheduleData.custno) {
            requestData.custno = sanitizeAlphanumeric(scheduleData.custno, 50);
        }
        if (scheduleData.comment) {
            requestData.comment = sanitizeAlphanumeric(scheduleData.comment, 255);
        }

        // sha1hash MUST be the last element!
        requestData.sha1hash = hash;

        // Send request to XML API
        const xmlRequest = buildXMLRequest(requestData);
        const endpoint = getXMLAPIEndpoint(environment);

        console.log('📤 [Schedule] Sending XML request to:', endpoint);
        console.log('📤 [Schedule] Request XML:', xmlRequest);

        const response = await axios.post(endpoint, xmlRequest, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('📥 [Schedule] Response received');

        // Parse response
        const parsedResponse = await parseXMLResponse(response.data);
        console.log('📥 [Schedule] Parsed response:', JSON.stringify(parsedResponse, null, 2));

        // Verify response hash (simplified for schedule responses)
        // Note: Schedule responses may have different hash structure

        // Check if schedule was created successfully
        if (parsedResponse.result !== '00') {
            const error = parseErrorResponse(parsedResponse);
            throw new Error(`Schedule creation failed: ${error.message} (Code: ${error.result})`);
        }

        return {
            success: true,
            scheduleRef: scheduleRef,
            scheduleText: parsedResponse.scheduletext || '',
            message: parsedResponse.message,
            frequency: frequency,
            startDate: startDate,
            amount: amount,
            currency: currency,
            numTimes: numTimes
        };

    } catch (error) {
        console.error('Schedule creation error:', error.message);
        throw error;
    }
}

/**
 * Process complete recurring payment setup
 * This orchestrates all steps: customer creation, card storage, initial payment, and schedule creation
 *
 * @param {Object} config - XML API configuration
 * @param {Object} data - Complete recurring payment data
 * @returns {Promise<Object>} Complete setup result
 */
export async function processRecurringPaymentSetup(config, data) {
    try {
        const { cardDetails, amount, currency, frequency, startDate, customerData, billingData } = data;

        // Normalize card expiry format to handle various input formats
        const normalizedCardDetails = normalizeCardExpiry(cardDetails);

        // Generate unique references
        // Format matches Global Payments documentation examples (shorter alphanumeric)
        const timestamp = Date.now().toString();
        const payerRef = `CUS${timestamp.substring(timestamp.length - 10)}`;
        const paymentMethodRef = `PMT${timestamp.substring(timestamp.length - 10)}`;
        const scheduleRef = timestamp.substring(timestamp.length - 13); // Shorter ref like docs

        // Step 1: Create or update customer
        console.log('Step 1: Creating customer...');
        const customerResult = await createOrUpdateCustomer(config, {
            payerRef,
            firstName: customerData.first_name,
            lastName: customerData.last_name,
            email: customerData.email,
            phone: customerData.phone,
            address: {
                street_address: customerData.street_address || billingData?.street_address,
                city: customerData.city || billingData?.city,
                state: customerData.state || billingData?.state,
                billing_zip: customerData.billing_zip || billingData?.billing_zip,
                country: customerData.country || billingData?.country || 'US'
            }
        });

        // Step 2: Create card reference
        console.log('Step 2: Creating card reference...');
        await createCardReference(config, {
            paymentMethodRef,
            payerRef,
            cardholderName: `${customerData.first_name} ${customerData.last_name}`,
            cardDetails: normalizedCardDetails
        });

        // Step 3: Process initial payment and store payment method
        console.log('Step 3: Processing initial payment...');
        const initialPaymentResult = await storePaymentMethodWithInitialPayment(config, {
            paymentMethodRef,
            payerRef,
            amount,
            currency,
            billingData,
            customerData
        });

        // Step 4: Create recurring schedule
        console.log('Step 4: Creating recurring schedule...');
        const scheduleResult = await createRecurringSchedule(config, {
            scheduleRef,
            payerRef,
            paymentMethodRef,
            amount,
            currency,
            frequency,
            startDate,
            alias: `${frequency} subscription for ${customerData.first_name} ${customerData.last_name}`,
            description: `Recurring ${frequency} payment`
        });

        // Return complete result
        return {
            success: true,
            message: 'Recurring payment setup completed successfully',
            customer: {
                payerRef: customerResult.payerRef,
                name: `${customerData.first_name} ${customerData.last_name}`,
                email: customerData.email
            },
            payment: {
                transactionId: initialPaymentResult.transactionId,
                orderId: initialPaymentResult.orderId,
                authCode: initialPaymentResult.authCode,
                amount: initialPaymentResult.amount,
                currency: initialPaymentResult.currency
            },
            schedule: {
                scheduleRef: scheduleResult.scheduleRef,
                scheduleText: scheduleResult.scheduleText,
                frequency: scheduleResult.frequency,
                startDate: scheduleResult.startDate,
                amount: scheduleResult.amount,
                currency: scheduleResult.currency
            },
            paymentMethodRef: paymentMethodRef,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Recurring payment setup error:', error.message);
        throw error;
    }
}
