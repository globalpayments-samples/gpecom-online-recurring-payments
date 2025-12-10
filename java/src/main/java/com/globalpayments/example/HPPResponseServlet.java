package com.globalpayments.example;

import com.globalpayments.xmlapi.XmlApiUtils;
import io.github.cdimascio.dotenv.Dotenv;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * HPP Response Handler Servlet
 *
 * This servlet handles the response from the Hosted Payment Page (HPP)
 * and displays the payment result to the user.
 *
 * Endpoint:
 * - POST /hpp-response: Handle HPP response callback
 *
 * @author Global Payments
 * @version 1.0
 */
@WebServlet(urlPatterns = {"/hpp-response"})
public class HPPResponseServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;
    private final Dotenv dotenv = Dotenv.load();

    /**
     * Handles POST requests from HPP response callback.
     * Verifies the hash and displays payment result.
     *
     * @param request The HTTP request containing HPP response data
     * @param response The HTTP response
     * @throws ServletException If there's an error in servlet processing
     * @throws IOException If there's an I/O error
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("text/html");
        response.setCharacterEncoding("UTF-8");

        try {
            // Get configuration
            String merchantId = dotenv.get("MERCHANT_ID");
            String sharedSecret = dotenv.get("SHARED_SECRET");

            // Extract response parameters
            String timestamp = getParameter(request, "TIMESTAMP");
            String responsemerchantId = getParameter(request, "MERCHANT_ID");
            String orderId = getParameter(request, "ORDER_ID");
            String result = getParameter(request, "RESULT");
            String message = getParameter(request, "MESSAGE");
            String pasref = getParameter(request, "PASREF");
            String authcode = getParameter(request, "AUTHCODE", "");
            String sha1hash = getParameter(request, "SHA1HASH");
            String amount = getParameter(request, "AMOUNT", "");
            String currency = getParameter(request, "CURRENCY", "");

            // Generate expected hash
            Map<String, String> hashParams = new HashMap<>();
            hashParams.put("timestamp", timestamp);
            hashParams.put("merchantId", responsemerchantId);
            hashParams.put("orderId", orderId);
            hashParams.put("result", result);
            hashParams.put("message", message);
            hashParams.put("pasref", pasref);
            hashParams.put("authcode", authcode);

            String expectedHash = XmlApiUtils.generateHPPResponseHash(hashParams, sharedSecret);

            // Verify hash
            if (!expectedHash.equalsIgnoreCase(sha1hash)) {
                renderErrorPage(response, "Payment Verification Failed", 
                    "The payment response could not be verified. Please contact support.");
                return;
            }

            // Check result code
            boolean success = "00".equals(result);

            if (success) {
                renderSuccessPage(response, orderId, amount, currency, message, pasref, authcode);
            } else {
                renderErrorPage(response, "Payment Failed", 
                    "Payment failed: " + message + " (Code: " + result + ")");
            }

        } catch (Exception e) {
            e.printStackTrace();
            renderErrorPage(response, "Error Processing Response", 
                "An error occurred while processing the payment response: " + e.getMessage());
        }
    }

    /**
     * Get request parameter with default value
     */
    private String getParameter(HttpServletRequest request, String name, String defaultValue) {
        String value = request.getParameter(name);
        return value != null ? value : defaultValue;
    }

    /**
     * Get required request parameter
     */
    private String getParameter(HttpServletRequest request, String name) {
        return getParameter(request, name, "");
    }

    /**
     * Render success page
     */
    private void renderSuccessPage(HttpServletResponse response, String orderId, 
            String amount, String currency, String message, String pasref, String authcode) 
            throws IOException {
        
        PrintWriter out = response.getWriter();
        
        out.println("<!DOCTYPE html>");
        out.println("<html>");
        out.println("<head>");
        out.println("    <title>Payment Successful</title>");
        out.println("    <style>");
        out.println("        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }");
        out.println("        .success { color: #28a745; }");
        out.println("        .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }");
        out.println("        .details p { margin: 5px 0; }");
        out.println("        button { margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }");
        out.println("        button:hover { background-color: #0056b3; }");
        out.println("    </style>");
        out.println("</head>");
        out.println("<body>");
        out.println("    <h1 class=\"success\">✓ Payment Successful</h1>");
        out.println("    <p>Your payment has been processed successfully.</p>");
        out.println("    <div class=\"details\">");
        out.println("        <h3>Transaction Details</h3>");
        out.println("        <p><strong>Order ID:</strong> " + escapeHtml(orderId) + "</p>");
        
        if (!amount.isEmpty()) {
            try {
                int amountInCents = Integer.parseInt(amount);
                double amountInDollars = amountInCents / 100.0;
                out.println("        <p><strong>Amount:</strong> " + 
                    String.format("%.2f", amountInDollars) + " " + escapeHtml(currency) + "</p>");
            } catch (NumberFormatException e) {
                out.println("        <p><strong>Amount:</strong> " + escapeHtml(amount) + " " + escapeHtml(currency) + "</p>");
            }
        }
        
        out.println("        <p><strong>Status:</strong> " + escapeHtml(message) + "</p>");
        out.println("        <p><strong>Reference:</strong> " + escapeHtml(pasref) + "</p>");
        
        if (!authcode.isEmpty()) {
            out.println("        <p><strong>Auth Code:</strong> " + escapeHtml(authcode) + "</p>");
        }
        
        out.println("    </div>");
        out.println("    <button onclick=\"window.close()\">Close Window</button>");
        out.println("</body>");
        out.println("</html>");
    }

    /**
     * Render error page
     */
    private void renderErrorPage(HttpServletResponse response, String title, String errorMessage) 
            throws IOException {
        
        PrintWriter out = response.getWriter();
        
        out.println("<!DOCTYPE html>");
        out.println("<html>");
        out.println("<head>");
        out.println("    <title>" + escapeHtml(title) + "</title>");
        out.println("    <style>");
        out.println("        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }");
        out.println("        .error { color: #dc3545; }");
        out.println("        button { margin-top: 20px; padding: 10px 20px; background-color: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; }");
        out.println("        button:hover { background-color: #5a6268; }");
        out.println("    </style>");
        out.println("</head>");
        out.println("<body>");
        out.println("    <h1 class=\"error\">✗ " + escapeHtml(title) + "</h1>");
        out.println("    <p>" + escapeHtml(errorMessage) + "</p>");
        out.println("    <button onclick=\"window.close()\">Close Window</button>");
        out.println("</body>");
        out.println("</html>");
    }

    /**
     * Simple HTML escape to prevent XSS
     */
    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&#x27;");
    }
}
