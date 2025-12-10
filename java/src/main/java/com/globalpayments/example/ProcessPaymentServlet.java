package com.globalpayments.example;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Configuration Servlet
 *
 * Note: This servlet is not used for XML API implementation.
 * XML API does not use client-side tokenization or public API keys.
 * Card data is handled directly server-side via XML API requests.
 *
 * Endpoint:
 * - GET /config: Returns info that XML API doesn't require client-side configuration
 *
 * @author Global Payments
 * @version 1.0
 */

@WebServlet(urlPatterns = {"/config"})
public class ProcessPaymentServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    /**
     * Handles GET requests to /config endpoint.
     * Returns message that XML API doesn't require client-side configuration.
     *
     * @param request The HTTP request
     * @param response The HTTP response
     * @throws ServletException If there's an error in servlet processing
     * @throws IOException If there's an I/O error
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        String jsonResponse = "{\"success\":true,\"message\":\"XML API does not require client-side configuration\"}";
        response.getWriter().write(jsonResponse);
    }
}
