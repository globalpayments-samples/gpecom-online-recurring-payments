package com.globalpayments.example;

import com.globalpayments.payment.PaymentUtils;
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
 * Recurring Payment Processing Servlet
 *
 * This servlet handles XML API recurring payment setup including:
 * - Customer creation in Card Storage
 * - Card reference storage
 * - Initial payment processing
 * - Recurring schedule creation
 *
 * Endpoint:
 * - POST /recurring-setup: Complete recurring payment setup
 *
 * @author Global Payments
 * @version 1.0
 */
@WebServlet(urlPatterns = {"/recurring-setup"})
public class RecurringPaymentServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;
    private final Dotenv dotenv = Dotenv.load();
    private final Gson gson = new Gson();

    /**
     * Handles POST requests to /recurring-setup endpoint.
     * Processes complete recurring payment setup using XML API.
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
            if (!jsonRequest.has("card_number") || !jsonRequest.has("card_expiry") || !jsonRequest.has("card_cvv")) {
                sendErrorResponse(response, 400, "Card information required", "MISSING_CARD_INFO");
                return;
            }

            if (!jsonRequest.has("amount") || !jsonRequest.has("frequency") || !jsonRequest.has("start_date")) {
                sendErrorResponse(response, 400, "Recurring payment details required", "MISSING_RECURRING_INFO");
                return;
            }

            if (!jsonRequest.has("first_name") || !jsonRequest.has("last_name") || !jsonRequest.has("email")) {
                sendErrorResponse(response, 400, "Customer information required", "MISSING_CUSTOMER_INFO");
                return;
            }

            // Parse card expiry (MM/YY format)
            String cardExpiry = jsonRequest.get("card_expiry").getAsString();
            String[] expiryParts = cardExpiry.split("/");
            if (expiryParts.length != 2) {
                sendErrorResponse(response, 400, "Invalid card expiry format. Expected MM/YY", "INVALID_EXPIRY");
                return;
            }

            String expMonth = expiryParts[0].trim();
            String expYear = expiryParts[1].trim();

            // Ensure month is 2 digits
            if (expMonth.length() == 1) {
                expMonth = "0" + expMonth;
            }

            // Prepare card details
            Map<String, String> cardDetails = new HashMap<>();
            cardDetails.put("number", jsonRequest.get("card_number").getAsString().replace(" ", ""));
            cardDetails.put("expmonth", expMonth);
            cardDetails.put("expyear", expYear);
            cardDetails.put("cvn", jsonRequest.get("card_cvv").getAsString());

            // Prepare customer data
            Map<String, String> customerData = new HashMap<>();
            customerData.put("first_name", jsonRequest.get("first_name").getAsString());
            customerData.put("last_name", jsonRequest.get("last_name").getAsString());
            customerData.put("email", jsonRequest.get("email").getAsString());

            if (jsonRequest.has("phone")) {
                customerData.put("phone", jsonRequest.get("phone").getAsString());
            }

            // Prepare billing data
            Map<String, String> billingData = new HashMap<>();
            if (jsonRequest.has("billing_zip")) {
                billingData.put("billing_zip", jsonRequest.get("billing_zip").getAsString());
            }
            if (jsonRequest.has("billing_country")) {
                billingData.put("country", jsonRequest.get("billing_country").getAsString());
            }
            if (jsonRequest.has("street_address")) {
                billingData.put("street_address", jsonRequest.get("street_address").getAsString());
                customerData.put("street_address", jsonRequest.get("street_address").getAsString());
            }
            if (jsonRequest.has("city")) {
                billingData.put("city", jsonRequest.get("city").getAsString());
                customerData.put("city", jsonRequest.get("city").getAsString());
            }
            if (jsonRequest.has("state")) {
                billingData.put("state", jsonRequest.get("state").getAsString());
                customerData.put("state", jsonRequest.get("state").getAsString());
            }
            if (jsonRequest.has("billing_zip")) {
                customerData.put("billing_zip", jsonRequest.get("billing_zip").getAsString());
            }
            if (jsonRequest.has("billing_country")) {
                customerData.put("country", jsonRequest.get("billing_country").getAsString());
            }

            // Get card name or construct from customer name
            String cardName = jsonRequest.has("card_name")
                ? jsonRequest.get("card_name").getAsString()
                : customerData.get("first_name") + " " + customerData.get("last_name");
            cardDetails.put("chname", cardName);

            // Prepare configuration
            Map<String, String> config = new HashMap<>();
            config.put("merchantId", dotenv.get("MERCHANT_ID"));
            config.put("sharedSecret", dotenv.get("SHARED_SECRET"));
            config.put("account", dotenv.get("ACCOUNT", "internet"));
            config.put("environment", dotenv.get("ENVIRONMENT", "sandbox"));

            // Prepare payment data
            Map<String, Object> paymentData = new HashMap<>();
            paymentData.put("cardDetails", cardDetails);
            paymentData.put("amount", jsonRequest.get("amount").getAsDouble());
            paymentData.put("currency", jsonRequest.has("currency") ? jsonRequest.get("currency").getAsString() : "USD");
            paymentData.put("frequency", jsonRequest.get("frequency").getAsString());
            paymentData.put("startDate", jsonRequest.get("start_date").getAsString());
            paymentData.put("customerData", customerData);
            paymentData.put("billingData", billingData);

            // Process recurring payment setup
            Map<String, Object> result = PaymentUtils.processRecurringPaymentSetup(config, paymentData);

            // Send success response
            sendSuccessResponse(response, result, "Recurring payment setup completed successfully");

        } catch (Exception e) {
            // Log the error
            e.printStackTrace();

            // Send error response
            sendErrorResponse(response, 500, e.getMessage(), "PROCESSING_ERROR");
        }
    }

    /**
     * Send success response
     */
    private void sendSuccessResponse(HttpServletResponse response, Map<String, Object> data, String message) throws IOException {
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("success", true);
        responseMap.put("message", message);
        responseMap.put("data", data);

        response.setStatus(HttpServletResponse.SC_OK);
        response.getWriter().write(gson.toJson(responseMap));
    }

    /**
     * Send error response
     */
    private void sendErrorResponse(HttpServletResponse response, int statusCode, String message, String errorCode) throws IOException {
        Map<String, Object> errorMap = new HashMap<>();
        errorMap.put("code", errorCode);
        errorMap.put("details", message);

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("success", false);
        responseMap.put("message", message);
        responseMap.put("error", errorMap);

        response.setStatus(statusCode);
        response.getWriter().write(gson.toJson(responseMap));
    }
}
