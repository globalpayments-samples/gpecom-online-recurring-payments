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

    // Auto-fill forms with test data on load
    autoFillPaymentForm();
    autoFillRecurringForm(0); // Use US customer by default

    // Add auto-fill buttons
    addAutoFillButtons();

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
 * Global Payments Test Cards
 * Source: https://developer.globalpay.com/test-cards
 */
const testCards = [
    {
        name: 'Visa - Approved',
        number: '4263970000005262',
        cvv: '123',
        expiry: '12/25',
        type: 'visa'
    },
    {
        name: 'Visa - Declined',
        number: '4000120000001154',
        cvv: '123',
        expiry: '12/25',
        type: 'visa'
    },
    {
        name: 'Mastercard - Approved',
        number: '5425230000004415',
        cvv: '123',
        expiry: '12/25',
        type: 'mastercard'
    },
    {
        name: 'Mastercard - Declined',
        number: '5114610000004778',
        cvv: '123',
        expiry: '12/25',
        type: 'mastercard'
    },
    {
        name: 'Amex - Approved',
        number: '374101000000608',
        cvv: '1234',
        expiry: '12/25',
        type: 'amex'
    },
    {
        name: 'Discover - Approved',
        number: '6011000000000087',
        cvv: '123',
        expiry: '12/25',
        type: 'discover'
    }
];

/**
 * Test data for different countries
 * Country codes use ISO 3166-1 numeric format (3 digits) as required by Global Payments HPP
 */
const testDataProfiles = [
    {
        name: 'US Customer',
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@example.com',
        phone: '555-123-4567',
        street_address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        billing_zip: '10001',
        country: '840'  // USA - ISO 3166-1 numeric
    },
    {
        name: 'UK Customer',
        first_name: 'James',
        last_name: 'Wilson',
        email: 'james.wilson@example.co.uk',
        phone: '020-7123-4567',
        street_address: '45 Baker Street',
        city: 'London',
        state: '',
        billing_zip: 'W1U 6TY',
        country: '826'  // United Kingdom - ISO 3166-1 numeric
    },
    {
        name: 'Canadian Customer',
        first_name: 'Emma',
        last_name: 'Johnson',
        email: 'emma.johnson@example.ca',
        phone: '416-555-0123',
        street_address: '789 Maple Avenue',
        city: 'Toronto',
        state: 'ON',
        billing_zip: 'M5H 2N2',
        country: '124'  // Canada - ISO 3166-1 numeric
    },
    {
        name: 'Australian Customer',
        first_name: 'Oliver',
        last_name: 'Brown',
        email: 'oliver.brown@example.com.au',
        phone: '02-9876-5432',
        street_address: '321 Sydney Road',
        city: 'Sydney',
        state: 'NSW',
        billing_zip: '2000',
        country: '036'  // Australia - ISO 3166-1 numeric
    },
    {
        name: 'German Customer',
        first_name: 'Hans',
        last_name: 'Mueller',
        email: 'hans.mueller@example.de',
        phone: '+49-30-12345678',
        street_address: 'Hauptstraße 42',
        city: 'Berlin',
        state: '',
        billing_zip: '10115',
        country: '276'  // Germany - ISO 3166-1 numeric
    },
    {
        name: 'Irish Customer',
        first_name: 'Liam',
        last_name: 'O\'Brien',
        email: 'liam.obrien@example.ie',
        phone: '01-234-5678',
        street_address: '56 Grafton Street',
        city: 'Dublin',
        state: '',
        billing_zip: 'D02 XY45',
        country: '372'  // Ireland - ISO 3166-1 numeric
    }
];

/**
 * Auto-fill form with test data
 */
function autoFillRecurringForm(profileIndex = 0) {
    const profile = testDataProfiles[profileIndex % testDataProfiles.length];

    // Customer Information
    const firstNameInput = document.getElementById('recurring-first-name');
    const lastNameInput = document.getElementById('recurring-last-name');
    const emailInput = document.getElementById('recurring-email');
    const phoneInput = document.getElementById('recurring-phone');

    if (firstNameInput) firstNameInput.value = profile.first_name;
    if (lastNameInput) lastNameInput.value = profile.last_name;
    if (emailInput) emailInput.value = profile.email;
    if (phoneInput) phoneInput.value = profile.phone;

    // Billing Address
    const streetInput = document.getElementById('recurring-street-address');
    const cityInput = document.getElementById('recurring-city');
    const stateInput = document.getElementById('recurring-state');
    const zipInput = document.getElementById('recurring-billing-zip');
    const countryInput = document.getElementById('recurring-country');

    if (streetInput) streetInput.value = profile.street_address;
    if (cityInput) cityInput.value = profile.city;
    if (stateInput) stateInput.value = profile.state;
    if (zipInput) zipInput.value = profile.billing_zip;
    if (countryInput) countryInput.value = profile.country;

    console.log(`✅ Auto-filled form with: ${profile.name}`);
}

/**
 * Auto-fill payment form with test data
 */
function autoFillPaymentForm() {
    const amountInput = document.getElementById('amount');
    const currencySelect = document.getElementById('currency');
    const emailInput = document.getElementById('customer_email');
    const streetInput = document.getElementById('billing_street1');
    const cityInput = document.getElementById('billing_city');
    const postalCodeInput = document.getElementById('billing_postalcode');
    const countryInput = document.getElementById('billing_country');

    if (amountInput) amountInput.value = '19.99';
    if (currencySelect) currencySelect.value = 'USD';
    if (emailInput) emailInput.value = 'test.customer@example.com';
    if (streetInput) streetInput.value = '123 Test Street';
    if (cityInput) cityInput.value = 'Test City';
    if (postalCodeInput) postalCodeInput.value = '12345';
    if (countryInput) countryInput.value = '840';

    console.log('✅ Auto-filled payment form with test data');
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        console.log(`✅ Copied ${label}: ${text}`);
        // Show a brief visual feedback
        const toast = document.createElement('div');
        toast.textContent = `✓ Copied ${label}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.backgroundColor = '#28a745';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '10000';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

/**
 * Create test cards info panel
 */
function createTestCardsPanel() {
    const panel = document.createElement('div');
    panel.style.backgroundColor = '#f8f9fa';
    panel.style.border = '1px solid #dee2e6';
    panel.style.borderRadius = '8px';
    panel.style.padding = '16px';
    panel.style.marginBottom = '20px';

    const title = document.createElement('h3');
    title.textContent = '💳 Test Cards (Click to Copy)';
    title.style.margin = '0 0 12px 0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    panel.appendChild(title);

    const info = document.createElement('p');
    info.textContent = 'Click any card number to copy it to clipboard';
    info.style.fontSize = '13px';
    info.style.color = '#6c757d';
    info.style.marginBottom = '12px';
    panel.appendChild(info);

    const cardsGrid = document.createElement('div');
    cardsGrid.style.display = 'grid';
    cardsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    cardsGrid.style.gap = '12px';

    testCards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.style.backgroundColor = 'white';
        cardDiv.style.border = '1px solid #dee2e6';
        cardDiv.style.borderRadius = '6px';
        cardDiv.style.padding = '12px';
        cardDiv.style.cursor = 'pointer';
        cardDiv.style.transition = 'all 0.2s';

        cardDiv.addEventListener('mouseenter', () => {
            cardDiv.style.borderColor = '#007bff';
            cardDiv.style.boxShadow = '0 2px 8px rgba(0,123,255,0.1)';
        });

        cardDiv.addEventListener('mouseleave', () => {
            cardDiv.style.borderColor = '#dee2e6';
            cardDiv.style.boxShadow = 'none';
        });

        const cardName = document.createElement('div');
        cardName.textContent = card.name;
        cardName.style.fontWeight = '600';
        cardName.style.fontSize = '13px';
        cardName.style.marginBottom = '8px';
        cardName.style.color = card.name.includes('Approved') ? '#28a745' : '#dc3545';
        cardDiv.appendChild(cardName);

        const cardNumber = document.createElement('div');
        cardNumber.textContent = `Card: ${card.number}`;
        cardNumber.style.fontFamily = 'monospace';
        cardNumber.style.fontSize = '13px';
        cardNumber.style.marginBottom = '4px';
        cardDiv.appendChild(cardNumber);

        const cardDetails = document.createElement('div');
        cardDetails.textContent = `CVV: ${card.cvv} | Exp: ${card.expiry}`;
        cardDetails.style.fontSize = '12px';
        cardDetails.style.color = '#6c757d';
        cardDiv.appendChild(cardDetails);

        cardDiv.addEventListener('click', () => {
            copyToClipboard(card.number, card.name);
        });

        cardsGrid.appendChild(cardDiv);
    });

    panel.appendChild(cardsGrid);

    return panel;
}

/**
 * Add auto-fill buttons to forms
 */
function addAutoFillButtons() {
    // Add button to recurring form
    const recurringForm = document.getElementById('recurring-form');
    if (recurringForm) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginBottom = '16px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.flexWrap = 'wrap';

        // Create a dropdown for selecting test profiles
        const selectLabel = document.createElement('label');
        selectLabel.textContent = 'Quick Fill Test Data: ';
        selectLabel.style.marginRight = '8px';
        selectLabel.style.fontWeight = '500';

        const select = document.createElement('select');
        select.className = 'gp-select';
        select.style.flex = '1';
        select.style.minWidth = '200px';

        testDataProfiles.forEach((profile, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = profile.name;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            autoFillRecurringForm(parseInt(e.target.value));
        });

        buttonContainer.appendChild(selectLabel);
        buttonContainer.appendChild(select);

        // Insert at the top of the form
        recurringForm.insertBefore(buttonContainer, recurringForm.firstChild);

        // Add test cards panel after the dropdown
        const testCardsPanel = createTestCardsPanel();
        recurringForm.insertBefore(testCardsPanel, recurringForm.children[1]);
    }

    // Add button to payment form
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '🔄 Fill Test Data';
        button.className = 'gp-button';
        button.style.marginBottom = '16px';
        button.style.backgroundColor = '#6c757d';
        button.style.color = 'white';

        button.addEventListener('click', () => {
            autoFillPaymentForm();
        });

        // Insert at the top of the form
        paymentForm.insertBefore(button, paymentForm.firstChild);

        // Add test cards panel after the button
        const testCardsPanel = createTestCardsPanel();
        paymentForm.insertBefore(testCardsPanel, paymentForm.children[1]);
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
 * Open HPP using RealEx HPP library in embedded iframe mode
 */
function openHPPLightbox(hppData) {
    console.log('Opening HPP embedded iframe with data:', hppData);

    // Determine which form is being submitted by checking the active tab
    const activeTab = document.querySelector('.gp-tab-content.active');
    const activeForm = activeTab ? activeTab.querySelector('form') : null;

    if (!activeForm) {
        console.error('No active form found');
        return;
    }

    // Remove any existing iframe to ensure clean state
    let existingIframe = document.getElementById('hpp-iframe');
    if (existingIframe) {
        console.log('Removing existing iframe');
        existingIframe.remove();
    }

    // Create fresh iframe
    console.log('Creating new iframe...');
    const iframe = document.createElement('iframe');
    iframe.id = 'hpp-iframe';
    iframe.name = 'hpp-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = '1px solid #ddd';
    iframe.style.borderRadius = '8px';
    iframe.style.marginTop = '20px';
    iframe.style.backgroundColor = '#f9f9f9';
    iframe.setAttribute('allow', 'payment');
    iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-top-navigation');

    // Insert after the active form
    activeForm.parentNode.insertBefore(iframe, activeForm.nextSibling);
    console.log('Iframe created and inserted into DOM');

    // Show iframe and hide the active form
    console.log('Showing iframe, hiding form');
    iframe.style.display = 'block';
    activeForm.style.display = 'none';

    // Create a hidden form to submit HPP data to iframe
    let hppForm = document.getElementById('hpp-form-submit');
    if (hppForm) {
        hppForm.remove();
    }

    hppForm = document.createElement('form');
    hppForm.id = 'hpp-form-submit';
    hppForm.method = 'POST';
    hppForm.action = 'https://pay.sandbox.realexpayments.com/pay';
    hppForm.target = 'hpp-iframe';
    hppForm.style.display = 'none';

    // Add all HPP data as hidden inputs
    Object.entries(hppData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        hppForm.appendChild(input);
    });

    document.body.appendChild(hppForm);

    // Submit the form to the iframe after a small delay to ensure iframe is ready
    console.log('Submitting HPP form to iframe...');
    console.log('Form action:', hppForm.action);
    console.log('Form target:', hppForm.target);
    console.log('Form data:', Object.fromEntries(new FormData(hppForm)));

    // Use setTimeout to ensure iframe is fully ready
    setTimeout(() => {
        hppForm.submit();
        console.log('Form submitted successfully');
    }, 100);

    // Listen for messages from HPP
    window.addEventListener('message', function(event) {
        if (event.origin !== 'https://pay.sandbox.realexpayments.com') {
            return;
        }

        console.log('HPP message received:', event.data);

        // Handle response
        if (event.data && event.data.RESULT) {
            // Find the active tab and form
            const activeTab = document.querySelector('.gp-tab-content.active');
            const activeForm = activeTab ? activeTab.querySelector('form') : null;

            // Hide iframe and show form again
            iframe.style.display = 'none';
            if (activeForm) {
                activeForm.style.display = 'block';
            }

            if (event.data.RESULT === '00') {
                alert('✅ Payment successful!\n\nTransaction ID: ' + event.data.PASREF);
            } else {
                alert('❌ Payment failed: ' + event.data.MESSAGE);
            }
        }
    });
}


/**
 * Initialize recurring payment form with HPP
 * Uses Global Payments HPP with OFFER_SAVE_CARD for secure recurring setup
 */
function initializeRecurringForm() {
    const form = document.getElementById('recurring-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            showLoading(true, 'Preparing secure payment...');

            // Get form data
            const formData = new FormData(form);

            // Prepare HPP recurring request data
            const hppRecurringData = {
                amount: parseFloat(formData.get('amount')),
                currency: 'USD',
                frequency: formData.get('frequency'),
                start_date: formData.get('start_date'),
                // Customer information
                first_name: formData.get('first_name'),
                last_name: formData.get('last_name'),
                customer_email: formData.get('email'),
                customer_phone: formData.get('phone'),
                // Billing address
                billing_street1: formData.get('street_address'),
                billing_city: formData.get('city'),
                billing_state: formData.get('state'),
                billing_postalcode: formData.get('billing_zip'),
                billing_country: formData.get('country')
            };

            console.log('Requesting HPP for recurring payment setup...');

            // Get HPP parameters from backend
            const response = await fetch(`${API_BASE}/hpp-recurring-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hppRecurringData)
            });

            const result = await response.json();

            console.log('HPP Response:', result);

            if (result.success) {
                console.log('Opening HPP for recurring payment');
                showLoading(false); // Hide loading before opening iframe
                openHPPLightbox(result.data);
            } else {
                showLoading(false);
                showError(result.message || 'Failed to prepare recurring payment');
            }

        } catch (error) {
            console.error('Recurring payment error:', error);
            showError(`Recurring payment error: ${error.message}`);
        } finally {
            showLoading(false);
        }
    });
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
