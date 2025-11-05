/**
 * Test script for XML API integration
 * Tests both one-time and recurring payment flows
 */

import * as dotenv from 'dotenv';
import {
    processOneTimePayment,
    processRecurringPaymentSetup
} from './paymentUtils.js';

// Load environment variables
dotenv.config();

// Get configuration
function getConfig() {
    return {
        merchantId: process.env.MERCHANT_ID,
        sharedSecret: process.env.SHARED_SECRET,
        account: process.env.ACCOUNT || 'internet',
        environment: process.env.XML_API_ENVIRONMENT || 'sandbox'
    };
}

// Test data
const testCustomerData = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '1234567890',
    street_address: '123 Main St',
    city: 'New York',
    state: 'NY',
    billing_zip: '10001',
    country: 'US'
};

const testBillingData = {
    billing_zip: '10001',
    street_address: '123 Main St',
    city: 'New York',
    state: 'NY',
    country: 'US'
};

/**
 * Test one-time payment
 */
async function testOneTimePayment() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: One-Time Payment');
    console.log('='.repeat(60));

    try {
        const config = getConfig();

        // Test card from Global Payments documentation
        const testCardData = {
            number: '4012001037141112',  // Visa test card
            expmonth: '12',
            expyear: '25',
            cvn: '123',
            chname: 'John Doe',
            type: 'VISA'
        };

        const result = await processOneTimePayment(config, {
            token: testCardData,  // Pass card data object
            amount: 19.99,
            currency: 'USD',
            billingData: testBillingData,
            customerData: testCustomerData
        });

        console.log('\n✅ One-time payment SUCCESS:');
        console.log(JSON.stringify(result, null, 2));
        return true;

    } catch (error) {
        console.error('\n❌ One-time payment FAILED:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        return false;
    }
}

/**
 * Test recurring payment setup
 */
async function testRecurringPayment() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Recurring Payment Setup');
    console.log('='.repeat(60));

    try {
        const config = getConfig();

        // Test card from Global Payments documentation
        const testCardData = {
            number: '4012001037141112',  // Visa test card
            expmonth: '12',
            expyear: '25',
            cvn: '123',
            type: 'VISA'
        };

        // Start date: next month
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() + 1);

        const result = await processRecurringPaymentSetup(config, {
            cardDetails: testCardData,  // Pass card details object
            amount: 29.99,
            currency: 'USD',
            frequency: 'monthly',
            startDate: startDate.toISOString(),
            customerData: testCustomerData,
            billingData: testBillingData
        });

        console.log('\n✅ Recurring payment setup SUCCESS:');
        console.log(JSON.stringify(result, null, 2));
        return true;

    } catch (error) {
        console.error('\n❌ Recurring payment setup FAILED:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('Global Payments XML API - Test Suite');
    console.log('='.repeat(60));
    console.log(`Environment: ${process.env.XML_API_ENVIRONMENT || 'sandbox'}`);
    console.log(`Merchant ID: ${process.env.MERCHANT_ID}`);
    console.log(`Account: ${process.env.ACCOUNT || 'internet'}`);
    console.log('='.repeat(60));

    // Validate configuration
    const config = getConfig();
    if (!config.merchantId || !config.sharedSecret) {
        console.error('\n❌ ERROR: Missing configuration');
        console.error('Please ensure MERCHANT_ID and SHARED_SECRET are set in .env file');
        process.exit(1);
    }

    const results = {
        oneTime: false,
        recurring: false
    };

    // Test 1: One-time payment
    results.oneTime = await testOneTimePayment();

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Recurring payment
    results.recurring = await testRecurringPayment();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`One-time payment:         ${results.oneTime ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recurring payment setup:  ${results.recurring ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(60));

    const allPassed = results.oneTime && results.recurring;
    if (allPassed) {
        console.log('\n✅ All tests PASSED!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests FAILED. Please review errors above.');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
});
