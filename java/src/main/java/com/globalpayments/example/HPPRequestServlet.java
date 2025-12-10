package com.globalpayments.example;

import com.globalpayments.xmlapi.XmlApiUtils;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import io.github.cdimascio.dotenv.Dotenv;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * HPP Request Generation Servlet
 *
 * This servlet generates Hosted Payment Page (HPP) request JSON for
 * initiating secure payment collection via Global Payments HPP.
 *
 * Endpoint:
 * - POST /hpp-request: Generate HPP request JSON
 *
 * @author Global Payments
 * @version 1.0
 */
@WebServlet(urlPatterns = {"/hpp-request"})
public class HPPRequestServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;
    private final Dotenv dotenv = Dotenv.load();
    private final Gson gson = new Gson();

    /**
     * Handles POST requests to /hpp-request endpoint.
     * Generates HPP request JSON with authentication hash.
     *
     * @param request The HTTP request containing payment details
     * @param response The HTTP response
     * @throws ServletException If there's an error in servlet processing
     * @throws IOException If there's an I/O error
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        try {
            // Read request body
            StringBuilder requestBody = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;
            while ((line = reader.readLine()) != null) {
                requestBody.append(line);
            }

            // Parse JSON request
            JsonObject jsonRequest = gson.fromJson(requestBody.toString(), JsonObject.class);

            // Validate required fields
            if (!jsonRequest.has("amount")) {
                sendErrorResponse(response, 400, "Amount is required", "INVALID_AMOUNT");
                return;
            }

            double amount = jsonRequest.get("amount").getAsDouble();
            if (amount <= 0) {
                sendErrorResponse(response, 400, "Valid amount is required", "INVALID_AMOUNT");
                return;
            }

            // Get configuration
            String merchantId = dotenv.get("MERCHANT_ID");
            String sharedSecret = dotenv.get("SHARED_SECRET");
            String account = dotenv.get("ACCOUNT", "internet");

            // Validate configuration
            if (merchantId == null || sharedSecret == null) {
                sendErrorResponse(response, 500, "Server configuration error", "CONFIG_ERROR");
                return;
            }

            // Get optional parameters
            String currency = jsonRequest.has("currency") ? jsonRequest.get("currency").getAsString() : "USD";
            
            // Generate request parameters
            String timestamp = XmlApiUtils.generateTimestamp();
            String orderId = XmlApiUtils.generateOrderId("HPP");
            int amountInCents = XmlApiUtils.convertToCents(amount);

            // Generate hash
            Map<String, String> hashParams = new HashMap<>();
            hashParams.put("timestamp", timestamp);
            hashParams.put("merchantId", merchantId);
            hashParams.put("orderId", orderId);
            hashParams.put("amount", String.valueOf(amountInCents));
            hashParams.put("currency", currency);

            String hash = XmlApiUtils.generateHPPHash(hashParams, sharedSecret);

            // Build HPP request JSON
            Map<String, String> hppRequest = new HashMap<>();
            hppRequest.put("TIMESTAMP", timestamp);
            hppRequest.put("MERCHANT_ID", merchantId);
            hppRequest.put("ACCOUNT", account);
            hppRequest.put("ORDER_ID", orderId);
            hppRequest.put("AMOUNT", String.valueOf(amountInCents));
            hppRequest.put("CURRENCY", currency);
            hppRequest.put("AUTO_SETTLE_FLAG", "1");
            hppRequest.put("HPP_VERSION", "2");
            hppRequest.put("HPP_CHANNEL", "ECOM");
            
            // Build merchant response URL
            String protocol = request.getScheme();
            String serverName = request.getServerName();
            int serverPort = request.getServerPort();
            String contextPath = request.getContextPath();
            
            String merchantResponseUrl = protocol + "://" + serverName;
            if ((protocol.equals("http") && serverPort != 80) || (protocol.equals("https") && serverPort != 443)) {
                merchantResponseUrl += ":" + serverPort;
            }
            merchantResponseUrl += contextPath + "/hpp-response";
            
            hppRequest.put("MERCHANT_RESPONSE_URL", merchantResponseUrl);
            hppRequest.put("SHA1HASH", hash);

            // Add optional customer fields
            if (jsonRequest.has("customer_email")) {
                hppRequest.put("HPP_CUSTOMER_EMAIL", jsonRequest.get("customer_email").getAsString());
            }
            if (jsonRequest.has("customer_phone")) {
                hppRequest.put("HPP_CUSTOMER_PHONENUMBER_MOBILE", jsonRequest.get("customer_phone").getAsString());
            }

            // Add billing address fields
            if (jsonRequest.has("billing_street1")) {
                hppRequest.put("HPP_BILLING_STREET1", jsonRequest.get("billing_street1").getAsString());
            }
            if (jsonRequest.has("billing_street2")) {
                hppRequest.put("HPP_BILLING_STREET2", jsonRequest.get("billing_street2").getAsString());
            }
            if (jsonRequest.has("billing_street3")) {
                hppRequest.put("HPP_BILLING_STREET3", jsonRequest.get("billing_street3").getAsString());
            }
            if (jsonRequest.has("billing_city")) {
                hppRequest.put("HPP_BILLING_CITY", jsonRequest.get("billing_city").getAsString());
            }
            if (jsonRequest.has("billing_postalcode")) {
                hppRequest.put("HPP_BILLING_POSTALCODE", jsonRequest.get("billing_postalcode").getAsString());
            }
            if (jsonRequest.has("billing_country")) {
                hppRequest.put("HPP_BILLING_COUNTRY", jsonRequest.get("billing_country").getAsString());
            }

            // Add shipping address fields
            if (jsonRequest.has("shipping_street1")) {
                hppRequest.put("HPP_SHIPPING_STREET1", jsonRequest.get("shipping_street1").getAsString());
            }
            if (jsonRequest.has("shipping_street2")) {
                hppRequest.put("HPP_SHIPPING_STREET2", jsonRequest.get("shipping_street2").getAsString());
            }
            if (jsonRequest.has("shipping_street3")) {
                hppRequest.put("HPP_SHIPPING_STREET3", jsonRequest.get("shipping_street3").getAsString());
            }
            if (jsonRequest.has("shipping_city")) {
                hppRequest.put("HPP_SHIPPING_CITY", jsonRequest.get("shipping_city").getAsString());
            }
            if (jsonRequest.has("shipping_state")) {
                hppRequest.put("HPP_SHIPPING_STATE", jsonRequest.get("shipping_state").getAsString());
            }
            if (jsonRequest.has("shipping_postalcode")) {
                hppRequest.put("HPP_SHIPPING_POSTALCODE", jsonRequest.get("shipping_postalcode").getAsString());
            }
            if (jsonRequest.has("shipping_country")) {
                hppRequest.put("HPP_SHIPPING_COUNTRY", jsonRequest.get("shipping_country").getAsString());
            }

            // Send success response
            sendSuccessResponse(response, hppRequest, "HPP request generated successfully");

        } catch (Exception e) {
            e.printStackTrace();
            sendErrorResponse(response, 500, "Error generating HPP request: " + e.getMessage(), "HPP_ERROR");
        }
    }

    /**
     * Send standardized success response
     */
    private void sendSuccessResponse(HttpServletResponse response, Map<String, String> data, String message) throws IOException {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("data", data);
        result.put("message", message);
        result.put("timestamp", java.time.Instant.now().toString());

        response.getWriter().write(gson.toJson(result));
    }

    /**
     * Send standardized error response
     */
    private void sendErrorResponse(HttpServletResponse response, int statusCode, String message, String errorCode) throws IOException {
        response.setStatus(statusCode);
        
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("message", message);
        error.put("error_code", errorCode);
        error.put("timestamp", java.time.Instant.now().toString());

        response.getWriter().write(gson.toJson(error));
    }
}
