/**
 * Global Payments XML API - Frontend Integration
 *
 * This file handles client-side functionality for the payment forms including:
 * - Tab navigation
 * - Form handling for one-time and recurring payments
 * - Card data collection (simplified for XML API - using test cards directly)
 * - Communication with backend API
 *
 * Note: For production use with XML API, you would typically use:
 * - RealEx HPP (Hosted Payment Page) for PCI-compliant card collection
 * - Or implement proper tokenization with XML API JavaScript SDK
 * This example uses a simplified approach for demonstration purposes.
 */

// API Base URL
const API_BASE = window.location.origin;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Global Payments XML API - Initializing...');

    // Initialize tabs
    initializeTabs();

    // Initialize forms
    initializeHPPPaymentForm();
    initializeRecurringForm();

    // Set default start date to tomorrow
    setDefaultStartDate();

    console.log('Initialization complete');
});

/**
 * Initialize tab navigation
 */
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.gp-tab-button');
    const tabContents = document.querySelectorAll('.gp-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all tabs and buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

/**
 * Set default start date to tomorrow
 */
function setDefaultStartDate() {
    const startDateInput = document.getElementById('start-date');
    if (startDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];
        startDateInput.value = dateString;
        startDateInput.min = dateString; // Prevent selecting past dates
    }
}

/**
 * Initialize Hosted Payment Page (HPP) form using RealEx HPP library
 */
function initializeHPPPaymentForm() {
    const form = document.getElementById('payment-form');
    if (!form) return;

    // Add button ID for RealEx library
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.id = 'pay-button';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            showLoading(true, 'Preparing secure payment page...');

            // Get form data
            const formData = new FormData(form);

            // Prepare HPP request data
            const hppRequestData = {
                amount: parseFloat(formData.get('amount')),
                currency: formData.get('currency'),
                customer_email: formData.get('customer_email'),
                billing_street1: formData.get('billing_street1'),
                billing_city: formData.get('billing_city'),
                billing_postalcode: formData.get('billing_postalcode'),
                billing_country: formData.get('billing_country')
            };

            // Get HPP request JSON from server
            const response = await fetch(`${API_BASE}/hpp-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hppRequestData)
            });

            const result = await response.json();
            showLoading(false);

            if (!result.success) {
                showError(result.message || 'Failed to generate payment request');
                return;
            }

            // Initialize RealEx HPP in lightbox mode
            openHPPLightbox(result.data);

        } catch (error) {
            console.error('HPP initialization error:', error);
            showError(`Error: ${error.message}`);
            showLoading(false);
        }
    });
}

/**
 * Open HPP using RealEx HPP library in lightbox mode
 */
function openHPPLightbox(hppData) {
    console.log('Opening HPP lightbox with data:', hppData);

    // Set HPP URL (sandbox)
    RealexHpp.setHppUrl('https://pay.sandbox.realexpayments.com/pay');

    // Initialize HPP in lightbox mode
    RealexHpp.lightbox.init(
        'pay-button',
        `${API_BASE}/hpp-response`,
        hppData
    );

    // The library will automatically open the lightbox with the styled payment form
    // Manual trigger since we already prevented default submit
    setTimeout(() => {
        RealexHpp.lightbox.open();
    }, 100);
}


/**
 * Initialize recurring payment form
 * Note: Recurring payments still use the backend API with card details
 * since HPP doesn't support the complete recurring setup workflow (customer creation, card storage, schedule creation)
 */
function initializeRecurringForm() {
    const form = document.getElementById('recurring-form');
    if (!form) return;

    // Create credit card form for recurring
    createSimplifiedCardForm('credit-card-recurring');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            showLoading(true, 'Setting up recurring payment...');

            // Get form data
            const formData = new FormData(form);

            // Get card data (in production, this would be tokenized)
            const cardData = getCardData('credit-card-recurring');

            // Prepare recurring payment data with card details
            const recurringData = {
                cardDetails: cardData,
                amount: parseFloat(formData.get('amount')),
                currency: 'USD',
                frequency: formData.get('frequency'),
                startDate: formData.get('start_date'),
                // Customer information
                customerData: {
                    first_name: formData.get('first_name'),
                    last_name: formData.get('last_name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    street_address: formData.get('street_address'),
                    city: formData.get('city'),
                    state: formData.get('state'),
                    billing_zip: formData.get('billing_zip'),
                    country: formData.get('country')
                },
                // Billing address
                billingData: {
                    street_address: formData.get('street_address'),
                    city: formData.get('city'),
                    state: formData.get('state'),
                    billing_zip: formData.get('billing_zip'),
                    country: formData.get('country')
                }
            };

            console.log('Submitting recurring payment setup...');

            // Send to backend - use the processRecurringPaymentSetup endpoint
            const response = await fetch(`${API_BASE}/recurring-setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(recurringData)
            });

            const result = await response.json();

            if (result.success) {
                showRecurringSuccess(result.data);
            } else {
                showError(result.message || 'Recurring payment setup failed');
            }

        } catch (error) {
            console.error('Recurring payment error:', error);
            showError(`Recurring payment setup error: ${error.message}`);
        } finally {
            showLoading(false);
        }
    });
}

/**
 * Create simplified card input form
 * In production, use proper XML API tokenization or RealEx HPP
 */
function createSimplifiedCardForm(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Card Number:</label>
            <input type="text"
                   class="card-number gp-input"
                   placeholder="4263970000005262"
                   maxlength="19"
                   style="width: 100%;"
                   required>
            <small style="color: #666; font-size: 12px;">Test card: 4263970000005262</small>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div>
                <label style="display: block; margin-bottom: 4px; font-weight: 500;">Exp Month:</label>
                <input type="text"
                       class="card-exp-month gp-input"
                       placeholder="12"
                       maxlength="2"
                       required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-weight: 500;">Exp Year:</label>
                <input type="text"
                       class="card-exp-year gp-input"
                       placeholder="25"
                       maxlength="2"
                       required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-weight: 500;">CVV:</label>
                <input type="text"
                       class="card-cvv gp-input"
                       placeholder="123"
                       maxlength="4"
                       required>
            </div>
        </div>
        <div style="margin-top: 8px;">
            <small style="color: #666; font-size: 12px;">
                <strong>Note:</strong> This is a simplified demo form. In production, use RealEx HPP or XML API tokenization for PCI compliance.
            </small>
        </div>
    `;
}

/**
 * Get card data from form
 */
function getCardData(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    return {
        number: container.querySelector('.card-number').value.replace(/\s/g, ''),
        expmonth: container.querySelector('.card-exp-month').value,
        expyear: container.querySelector('.card-exp-year').value,
        cvn: container.querySelector('.card-cvv').value,
        type: getCardType(container.querySelector('.card-number').value)
    };
}

/**
 * Determine card type from number
 */
function getCardType(number) {
    const cleanNumber = number.replace(/\s/g, '');
    if (cleanNumber.startsWith('4')) return 'VISA';
    if (cleanNumber.startsWith('5')) return 'MASTERCARD';
    if (cleanNumber.startsWith('37')) return 'AMEX';
    return 'UNKNOWN';
}

/**
 * Show loading indicator
 */
function showLoading(show, message = 'Processing...') {
    let loader = document.getElementById('loading-indicator');

    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loading-indicator';
            loader.className = 'gp-alert gp-alert-info';
            loader.style.position = 'fixed';
            loader.style.top = '20px';
            loader.style.right = '20px';
            loader.style.zIndex = '1000';
            loader.style.minWidth = '250px';
            document.body.appendChild(loader);
        }
        loader.innerHTML = `<strong>⏳ ${message}</strong>`;
        loader.style.display = 'block';
    } else {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

/**
 * Show success message
 */
function showSuccess(message, data) {
    alert(`✅ ${message}\n\nTransaction ID: ${data.transactionId || data.orderId || 'N/A'}`);
}

/**
 * Show recurring payment success
 */
function showRecurringSuccess(data) {
    const resultDiv = document.getElementById('recurring-result');
    const detailsDiv = document.getElementById('recurring-result-details');

    const details = `
        <p><strong>Initial Payment:</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Transaction ID: ${data.payment.transactionId}</li>
            <li>Amount: $${data.payment.amount} ${data.payment.currency}</li>
            <li>Auth Code: ${data.payment.authCode}</li>
        </ul>

        <p><strong>Customer:</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Name: ${data.customer.name}</li>
            <li>Email: ${data.customer.email}</li>
            <li>Reference: ${data.customer.payerRef}</li>
        </ul>

        <p><strong>Recurring Schedule:</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Frequency: ${data.schedule.frequency}</li>
            <li>Amount: $${data.schedule.amount} ${data.schedule.currency}</li>
            <li>Start Date: ${new Date(data.schedule.startDate).toLocaleDateString()}</li>
            <li>Schedule ID: ${data.schedule.scheduleRef}</li>
            <li>Description: ${data.schedule.scheduleText || 'Recurring payment schedule'}</li>
        </ul>

        <p style="margin-top: 16px; padding: 12px; background-color: #f0f9ff; border-radius: 4px;">
            <strong>✅ Success!</strong> Your recurring payment has been set up.
            The first scheduled payment will occur on ${new Date(data.schedule.startDate).toLocaleDateString()}.
        </p>
    `;

    detailsDiv.innerHTML = details;
    resultDiv.classList.remove('gp-hidden');

    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show error message
 */
function showError(message) {
    alert(`❌ Error: ${message}`);
}
