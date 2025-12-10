package com.globalpayments.payment;

import com.globalpayments.xmlapi.XmlApiUtils;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Payment Processing Utilities for XML API
 *
 * This class handles:
 * - One-time payment processing
 * - Recurring payment setup
 * - Customer and payment method storage
 * - Payment Scheduler integration
 */
public class PaymentUtils {

    private static final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Create or update customer (payer) in Card Storage
     */
    public static Map<String, Object> createOrUpdateCustomer(Map<String, String> config, Map<String, Object> customerData) throws Exception {
        String merchantId = config.get("merchantId");
        String sharedSecret = config.get("sharedSecret");
        String environment = config.getOrDefault("environment", "sandbox");

        String payerRef = (String) customerData.get("payerRef");
        String firstName = (String) customerData.getOrDefault("firstName", "");
        String lastName = (String) customerData.getOrDefault("lastName", "");
        String email = (String) customerData.getOrDefault("email", "");
        String phone = (String) customerData.getOrDefault("phone", "");
        @SuppressWarnings("unchecked")
        Map<String, String> address = (Map<String, String>) customerData.getOrDefault("address", new HashMap<>());

        String timestamp = XmlApiUtils.generateTimestamp();
        String orderId = XmlApiUtils.generateOrderId("CUST");

        // Generate hash for payer-new
        Map<String, String> hashParams = new HashMap<>();
        hashParams.put("timestamp", timestamp);
        hashParams.put("merchantId", merchantId);
        hashParams.put("orderId", orderId);
        hashParams.put("payerRef", payerRef);
        String hashVal = XmlApiUtils.generatePayerNewHash(hashParams, sharedSecret);

        // Build request data
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("timestamp", timestamp);
        requestData.put("merchantid", merchantId);
        requestData.put("orderid", orderId);

        // Payer information
        Map<String, Object> payer = new HashMap<>();
        payer.put("title", "");
        payer.put("firstname", XmlApiUtils.sanitizeAlphanumeric(firstName, 100));
        payer.put("surname", XmlApiUtils.sanitizeAlphanumeric(lastName, 100));
        payer.put("company", "");

        // Add address if provided
        if (!address.isEmpty()) {
            String countryCode = XmlApiUtils.convertCountryCodeToAlpha2(address.getOrDefault("country", "US"));
            Map<String, Object> addressData = new HashMap<>();
            addressData.put("line1", XmlApiUtils.sanitizeAlphanumeric(address.getOrDefault("street_address", ""), 50));
            addressData.put("line2", "");
            addressData.put("line3", "");
            addressData.put("city", XmlApiUtils.sanitizeAlphanumeric(address.getOrDefault("city", ""), 40));
            addressData.put("county", XmlApiUtils.sanitizeAlphanumeric(address.getOrDefault("state", ""), 40));
            addressData.put("postcode", XmlApiUtils.sanitizePostalCode(address.getOrDefault("billing_zip", "")));
            addressData.put("country", countryCode);

            payer.put("address", addressData);
        }

        // Add phone if provided
        if (phone != null && !phone.isEmpty()) {
            Map<String, String> phoneNumbers = new HashMap<>();
            phoneNumbers.put("home", XmlApiUtils.sanitizeAlphanumeric(phone, 20));
            payer.put("phonenumbers", phoneNumbers);
        }

        // Add email
        payer.put("email", XmlApiUtils.sanitizeAlphanumeric(email, 255));

        requestData.put("payer", payer);
        requestData.put("sha1hash", hashVal);

        // Build and send XML request
        String xmlRequest = buildPayerNewXml(timestamp, merchantId, orderId, payer, payerRef, hashVal);
        String endpoint = XmlApiUtils.getXmlApiEndpoint(environment);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/xml")
                .POST(HttpRequest.BodyPublishers.ofString(xmlRequest))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> parsedResponse = XmlApiUtils.parseXmlResponse(response.body());

        // Check result (00 = success, 501 = payer already exists - both acceptable)
        String result = (String) parsedResponse.get("result");
        if (!"00".equals(result) && !"501".equals(result)) {
            throw new Exception("Customer creation failed: " + parsedResponse.get("message") + " (Code: " + result + ")");
        }

        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("success", true);
        resultMap.put("payerRef", payerRef);
        resultMap.put("message", parsedResponse.get("message"));
        resultMap.put("alreadyExists", "501".equals(result));

        return resultMap;
    }

    /**
     * Create card reference in Card Storage API
     */
    public static Map<String, Object> createCardReference(Map<String, String> config, Map<String, Object> cardData) throws Exception {
        String merchantId = config.get("merchantId");
        String sharedSecret = config.get("sharedSecret");
        String environment = config.getOrDefault("environment", "sandbox");

        String paymentMethodRef = (String) cardData.get("paymentMethodRef");
        String payerRef = (String) cardData.get("payerRef");
        String cardholderName = (String) cardData.get("cardholderName");
        @SuppressWarnings("unchecked")
        Map<String, String> cardDetails = (Map<String, String>) cardData.get("cardDetails");

        String timestamp = XmlApiUtils.generateTimestamp();
        String orderId = XmlApiUtils.generateOrderId("CARD");

        // Generate hash for card-new
        Map<String, String> hashParams = new HashMap<>();
        hashParams.put("timestamp", timestamp);
        hashParams.put("merchantId", merchantId);
        hashParams.put("orderId", orderId);
        hashParams.put("payerRef", payerRef);
        hashParams.put("chname", XmlApiUtils.sanitizeAlphanumeric(cardholderName, 100));
        hashParams.put("cardNumber", cardDetails.get("number"));
        String hashVal = XmlApiUtils.generateCardNewHash(hashParams, sharedSecret);

        // Build XML request
        String expDate = cardDetails.get("expmonth") + cardDetails.get("expyear");
        String xmlRequest = buildCardNewXml(timestamp, merchantId, orderId, paymentMethodRef, payerRef,
                XmlApiUtils.sanitizeAlphanumeric(cardholderName, 100), cardDetails.get("number"), expDate,
                cardDetails.getOrDefault("type", "VISA"), hashVal);

        String endpoint = XmlApiUtils.getXmlApiEndpoint(environment);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/xml")
                .POST(HttpRequest.BodyPublishers.ofString(xmlRequest))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> parsedResponse = XmlApiUtils.parseXmlResponse(response.body());

        // Check result (00 = success, 520 = card already exists - both acceptable)
        String result = (String) parsedResponse.get("result");
        if (!"00".equals(result) && !"520".equals(result)) {
            throw new Exception("Card reference creation failed: " + parsedResponse.get("message") + " (Code: " + result + ")");
        }

        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("success", true);
        resultMap.put("paymentMethodRef", paymentMethodRef);
        resultMap.put("payerRef", payerRef);
        resultMap.put("message", parsedResponse.get("message"));
        resultMap.put("alreadyExists", "520".equals(result));

        return resultMap;
    }

    /**
     * Store payment method (card) for recurring use with initial payment
     */
    public static Map<String, Object> storePaymentMethodWithInitialPayment(Map<String, String> config, Map<String, Object> paymentData) throws Exception {
        String merchantId = config.get("merchantId");
        String sharedSecret = config.get("sharedSecret");
        String account = config.getOrDefault("account", "internet");
        String environment = config.getOrDefault("environment", "sandbox");

        String paymentMethodRef = (String) paymentData.get("paymentMethodRef");
        String payerRef = (String) paymentData.get("payerRef");
        double amount = ((Number) paymentData.get("amount")).doubleValue();
        String currency = (String) paymentData.getOrDefault("currency", "USD");
        @SuppressWarnings("unchecked")
        Map<String, String> billingData = (Map<String, String>) paymentData.getOrDefault("billingData", new HashMap<>());

        String timestamp = XmlApiUtils.generateTimestamp();
        String orderId = XmlApiUtils.generateOrderId("INIT");
        int amountInCents = XmlApiUtils.convertToCents(amount);

        // Generate hash for receipt-in with stored card
        Map<String, String> hashParams = new HashMap<>();
        hashParams.put("timestamp", timestamp);
        hashParams.put("merchantId", merchantId);
        hashParams.put("orderId", orderId);
        hashParams.put("amount", String.valueOf(amountInCents));
        hashParams.put("currency", currency);
        hashParams.put("payerRef", payerRef);
        String hashVal = XmlApiUtils.generateStoredCardPaymentHash(hashParams, sharedSecret);

        // Build XML request
        String xmlRequest = buildReceiptInXml(timestamp, merchantId, account, orderId, amountInCents, currency,
                payerRef, paymentMethodRef, billingData, hashVal);

        String endpoint = XmlApiUtils.getXmlApiEndpoint(environment);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/xml")
                .POST(HttpRequest.BodyPublishers.ofString(xmlRequest))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> parsedResponse = XmlApiUtils.parseXmlResponse(response.body());

        // Check if payment was successful
        String result = (String) parsedResponse.get("result");
        if (!"00".equals(result)) {
            throw new Exception("Initial payment failed: " + parsedResponse.get("message") + " (Code: " + result + ")");
        }

        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("success", true);
        resultMap.put("transactionId", parsedResponse.get("pasref"));
        resultMap.put("orderId", parsedResponse.get("orderid"));
        resultMap.put("authCode", parsedResponse.get("authcode"));
        resultMap.put("payerRef", payerRef);
        resultMap.put("paymentMethodRef", paymentMethodRef);
        resultMap.put("amount", amount);
        resultMap.put("currency", currency);
        resultMap.put("message", "Initial payment successful - payment method stored for recurring use");
        resultMap.put("timestamp", parsedResponse.get("timestamp"));

        return resultMap;
    }

    /**
     * Create recurring payment schedule using Payment Scheduler API
     */
    public static Map<String, Object> createRecurringSchedule(Map<String, String> config, Map<String, Object> scheduleData) throws Exception {
        String merchantId = config.get("merchantId");
        String sharedSecret = config.get("sharedSecret");
        String account = config.getOrDefault("account", "internet");
        String environment = config.getOrDefault("environment", "sandbox");

        String scheduleRef = (String) scheduleData.get("scheduleRef");
        String payerRef = (String) scheduleData.get("payerRef");
        String paymentMethodRef = (String) scheduleData.get("paymentMethodRef");
        double amount = ((Number) scheduleData.get("amount")).doubleValue();
        String currency = (String) scheduleData.getOrDefault("currency", "USD");
        String frequency = (String) scheduleData.get("frequency");
        String startDate = (String) scheduleData.getOrDefault("startDate", "");
        int numTimes = scheduleData.containsKey("numTimes") ? ((Number) scheduleData.get("numTimes")).intValue() : -1;

        String timestamp = XmlApiUtils.generateTimestamp();
        int amountInCents = XmlApiUtils.convertToCents(amount);
        String schedule = XmlApiUtils.mapFrequencyToSchedule(frequency);

        // Generate hash for schedule-new
        Map<String, String> hashParams = new HashMap<>();
        hashParams.put("timestamp", timestamp);
        hashParams.put("merchantId", merchantId);
        hashParams.put("scheduleRef", scheduleRef);
        hashParams.put("amount", String.valueOf(amountInCents));
        hashParams.put("currency", currency);
        hashParams.put("payerRef", payerRef);
        hashParams.put("schedule", schedule);
        String hashVal = XmlApiUtils.generateScheduleHash(hashParams, sharedSecret);

        // Build XML request
        String xmlRequest = buildScheduleNewXml(timestamp, merchantId, account, scheduleRef, schedule, numTimes,
                payerRef, paymentMethodRef, amountInCents, currency, hashVal);

        String endpoint = XmlApiUtils.getXmlApiEndpoint(environment);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/xml")
                .POST(HttpRequest.BodyPublishers.ofString(xmlRequest))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> parsedResponse = XmlApiUtils.parseXmlResponse(response.body());

        // Check if schedule was created successfully
        String result = (String) parsedResponse.get("result");
        if (!"00".equals(result)) {
            throw new Exception("Schedule creation failed: " + parsedResponse.get("message") + " (Code: " + result + ")");
        }

        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("success", true);
        resultMap.put("scheduleRef", scheduleRef);
        resultMap.put("scheduleText", parsedResponse.getOrDefault("scheduletext", ""));
        resultMap.put("message", parsedResponse.get("message"));
        resultMap.put("frequency", frequency);
        resultMap.put("startDate", startDate);
        resultMap.put("amount", amount);
        resultMap.put("currency", currency);
        resultMap.put("numTimes", numTimes);

        return resultMap;
    }

    /**
     * Process complete recurring payment setup
     */
    public static Map<String, Object> processRecurringPaymentSetup(Map<String, String> config, Map<String, Object> data) throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, String> cardDetails = (Map<String, String>) data.get("cardDetails");
        double amount = ((Number) data.get("amount")).doubleValue();
        String currency = (String) data.getOrDefault("currency", "USD");
        String frequency = (String) data.get("frequency");
        String startDate = (String) data.get("startDate");
        @SuppressWarnings("unchecked")
        Map<String, String> customerData = (Map<String, String>) data.get("customerData");
        @SuppressWarnings("unchecked")
        Map<String, String> billingData = (Map<String, String>) data.getOrDefault("billingData", new HashMap<>());

        // Normalize card expiry format
        Map<String, String> normalizedCardDetails = XmlApiUtils.normalizeCardExpiry(cardDetails);

        // Generate unique references
        long timestampMs = System.currentTimeMillis();
        String timestampStr = String.valueOf(timestampMs);
        String payerRef = "CUS" + timestampStr.substring(timestampStr.length() - 10);
        String paymentMethodRef = "PMT" + timestampStr.substring(timestampStr.length() - 10);
        String scheduleRef = timestampStr.substring(timestampStr.length() - 13);

        // Step 1: Create or update customer
        Map<String, Object> customerParams = new HashMap<>();
        customerParams.put("payerRef", payerRef);
        customerParams.put("firstName", customerData.get("first_name"));
        customerParams.put("lastName", customerData.get("last_name"));
        customerParams.put("email", customerData.get("email"));
        customerParams.put("phone", customerData.get("phone"));

        Map<String, String> addressParams = new HashMap<>();
        addressParams.put("street_address", customerData.getOrDefault("street_address", billingData.getOrDefault("street_address", "")));
        addressParams.put("city", customerData.getOrDefault("city", billingData.getOrDefault("city", "")));
        addressParams.put("state", customerData.getOrDefault("state", billingData.getOrDefault("state", "")));
        addressParams.put("billing_zip", customerData.getOrDefault("billing_zip", billingData.getOrDefault("billing_zip", "")));
        addressParams.put("country", customerData.getOrDefault("country", billingData.getOrDefault("country", "US")));
        customerParams.put("address", addressParams);

        Map<String, Object> customerResult = createOrUpdateCustomer(config, customerParams);

        // Step 2: Create card reference
        Map<String, Object> cardParams = new HashMap<>();
        cardParams.put("paymentMethodRef", paymentMethodRef);
        cardParams.put("payerRef", payerRef);
        cardParams.put("cardholderName", customerData.get("first_name") + " " + customerData.get("last_name"));
        cardParams.put("cardDetails", normalizedCardDetails);

        Map<String, Object> cardResult = createCardReference(config, cardParams);

        // Step 3: Process initial payment and store payment method
        Map<String, Object> paymentParams = new HashMap<>();
        paymentParams.put("paymentMethodRef", paymentMethodRef);
        paymentParams.put("payerRef", payerRef);
        paymentParams.put("amount", amount);
        paymentParams.put("currency", currency);
        paymentParams.put("billingData", billingData);
        paymentParams.put("customerData", customerData);

        Map<String, Object> initialPaymentResult = storePaymentMethodWithInitialPayment(config, paymentParams);

        // Step 4: Create recurring schedule
        Map<String, Object> scheduleParams = new HashMap<>();
        scheduleParams.put("scheduleRef", scheduleRef);
        scheduleParams.put("payerRef", payerRef);
        scheduleParams.put("paymentMethodRef", paymentMethodRef);
        scheduleParams.put("amount", amount);
        scheduleParams.put("currency", currency);
        scheduleParams.put("frequency", frequency);
        scheduleParams.put("startDate", startDate);

        Map<String, Object> scheduleResult = createRecurringSchedule(config, scheduleParams);

        // Return complete result
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Recurring payment setup completed successfully");

        Map<String, Object> customer = new HashMap<>();
        customer.put("payerRef", customerResult.get("payerRef"));
        customer.put("name", customerData.get("first_name") + " " + customerData.get("last_name"));
        customer.put("email", customerData.get("email"));
        result.put("customer", customer);

        Map<String, Object> payment = new HashMap<>();
        payment.put("transactionId", initialPaymentResult.get("transactionId"));
        payment.put("orderId", initialPaymentResult.get("orderId"));
        payment.put("authCode", initialPaymentResult.get("authCode"));
        payment.put("amount", initialPaymentResult.get("amount"));
        payment.put("currency", initialPaymentResult.get("currency"));
        result.put("payment", payment);

        Map<String, Object> schedule = new HashMap<>();
        schedule.put("scheduleRef", scheduleResult.get("scheduleRef"));
        schedule.put("scheduleText", scheduleResult.get("scheduleText"));
        schedule.put("frequency", scheduleResult.get("frequency"));
        schedule.put("startDate", scheduleResult.get("startDate"));
        schedule.put("amount", scheduleResult.get("amount"));
        schedule.put("currency", scheduleResult.get("currency"));
        result.put("schedule", schedule);

        result.put("paymentMethodRef", paymentMethodRef);
        result.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME));

        return result;
    }

    // XML building helper methods

    private static String buildPayerNewXml(String timestamp, String merchantId, String orderId,
                                           Map<String, Object> payer, String payerRef, String hash) {
        StringBuilder xml = new StringBuilder();
        xml.append("<request type=\"payer-new\" timestamp=\"").append(timestamp).append("\">");
        xml.append("<merchantid>").append(merchantId).append("</merchantid>");
        xml.append("<orderid>").append(orderId).append("</orderid>");
        xml.append("<payer type=\"Retail\" ref=\"").append(payerRef).append("\">");
        xml.append("<title>").append(payer.getOrDefault("title", "")).append("</title>");
        xml.append("<firstname>").append(payer.get("firstname")).append("</firstname>");
        xml.append("<surname>").append(payer.get("surname")).append("</surname>");
        xml.append("<company>").append(payer.getOrDefault("company", "")).append("</company>");

        if (payer.containsKey("address")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> address = (Map<String, Object>) payer.get("address");
            xml.append("<address>");
            xml.append("<line1>").append(address.get("line1")).append("</line1>");
            xml.append("<line2>").append(address.getOrDefault("line2", "")).append("</line2>");
            xml.append("<line3>").append(address.getOrDefault("line3", "")).append("</line3>");
            xml.append("<city>").append(address.get("city")).append("</city>");
            xml.append("<county>").append(address.get("county")).append("</county>");
            xml.append("<postcode>").append(address.get("postcode")).append("</postcode>");
            String country = (String) address.get("country");
            xml.append("<country code=\"").append(country).append("\">").append(country).append("</country>");
            xml.append("</address>");
        }

        if (payer.containsKey("phonenumbers")) {
            @SuppressWarnings("unchecked")
            Map<String, String> phones = (Map<String, String>) payer.get("phonenumbers");
            xml.append("<phonenumbers>");
            xml.append("<home>").append(phones.get("home")).append("</home>");
            xml.append("</phonenumbers>");
        }

        xml.append("<email>").append(payer.get("email")).append("</email>");
        xml.append("</payer>");
        xml.append("<sha1hash>").append(hash).append("</sha1hash>");
        xml.append("</request>");

        return xml.toString();
    }

    private static String buildCardNewXml(String timestamp, String merchantId, String orderId,
                                          String ref, String payerRef, String chname, String number,
                                          String expDate, String type, String hash) {
        StringBuilder xml = new StringBuilder();
        xml.append("<request type=\"card-new\" timestamp=\"").append(timestamp).append("\">");
        xml.append("<merchantid>").append(merchantId).append("</merchantid>");
        xml.append("<orderid>").append(orderId).append("</orderid>");
        xml.append("<card>");
        xml.append("<ref>").append(ref).append("</ref>");
        xml.append("<payerref>").append(payerRef).append("</payerref>");
        xml.append("<chname>").append(chname).append("</chname>");
        xml.append("<number>").append(number).append("</number>");
        xml.append("<expdate>").append(expDate).append("</expdate>");
        xml.append("<type>").append(type).append("</type>");
        xml.append("</card>");
        xml.append("<sha1hash>").append(hash).append("</sha1hash>");
        xml.append("</request>");

        return xml.toString();
    }

    private static String buildReceiptInXml(String timestamp, String merchantId, String account,
                                            String orderId, int amount, String currency, String payerRef,
                                            String paymentMethod, Map<String, String> billingData, String hash) {
        StringBuilder xml = new StringBuilder();
        xml.append("<request type=\"receipt-in\" timestamp=\"").append(timestamp).append("\">");
        xml.append("<merchantid>").append(merchantId).append("</merchantid>");
        xml.append("<account>").append(account).append("</account>");
        xml.append("<orderid>").append(orderId).append("</orderid>");
        xml.append("<amount currency=\"").append(currency).append("\">").append(amount).append("</amount>");
        xml.append("<payerref>").append(payerRef).append("</payerref>");
        xml.append("<paymentmethod>").append(paymentMethod).append("</paymentmethod>");
        xml.append("<autosettle flag=\"1\"/>");
        xml.append("<recurring type=\"fixed\" sequence=\"first\"/>");

        if (billingData != null && billingData.containsKey("billing_zip")) {
            String country = XmlApiUtils.convertCountryCodeToAlpha2(billingData.getOrDefault("country", "US"));
            xml.append("<tssinfo>");
            xml.append("<address>");
            xml.append("<code>").append(XmlApiUtils.sanitizePostalCode(billingData.get("billing_zip"))).append("</code>");
            xml.append("<country>").append(country).append("</country>");
            xml.append("</address>");
            xml.append("</tssinfo>");
        }

        xml.append("<sha1hash>").append(hash).append("</sha1hash>");
        xml.append("</request>");

        return xml.toString();
    }

    private static String buildScheduleNewXml(String timestamp, String merchantId, String account,
                                              String scheduleRef, String schedule, int numTimes,
                                              String payerRef, String paymentMethod, int amount,
                                              String currency, String hash) {
        StringBuilder xml = new StringBuilder();
        xml.append("<request type=\"schedule-new\" timestamp=\"").append(timestamp).append("\">");
        xml.append("<merchantid>").append(merchantId).append("</merchantid>");
        xml.append("<account>").append(account).append("</account>");
        xml.append("<scheduleref>").append(scheduleRef).append("</scheduleref>");
        xml.append("<transtype>auth</transtype>");
        xml.append("<schedule>").append(schedule).append("</schedule>");
        xml.append("<numtimes>").append(numTimes).append("</numtimes>");
        xml.append("<payerref>").append(payerRef).append("</payerref>");
        xml.append("<paymentmethod>").append(paymentMethod).append("</paymentmethod>");
        xml.append("<amount currency=\"").append(currency).append("\">").append(amount).append("</amount>");
        xml.append("<sha1hash>").append(hash).append("</sha1hash>");
        xml.append("</request>");

        return xml.toString();
    }
}
