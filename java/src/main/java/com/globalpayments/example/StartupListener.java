package com.globalpayments.example;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;
import io.github.cdimascio.dotenv.Dotenv;

@WebListener
public class StartupListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        try {
            Dotenv dotenv = Dotenv.configure()
                .directory(System.getProperty("user.dir"))
                .ignoreIfMissing()
                .load();

            String port = System.getenv("PORT");
            if (port == null) {
                port = "8000";
            }
            
            String merchantId = dotenv.get("MERCHANT_ID", "[not configured]");
            String environment = dotenv.get("ENVIRONMENT", "sandbox");

            System.out.println("============================================================");
            System.out.println("Global Payments XML API - Recurring Payments Server");
            System.out.println("============================================================");
            System.out.println("Server running at: http://localhost:" + port);
            System.out.println("Environment: " + environment);
            System.out.println("Merchant ID: " + merchantId);
            System.out.println("");
            System.out.println("Available endpoints:");
            System.out.println("  GET  /health           - Health check");
            System.out.println("  GET  /config           - Get configuration");
            System.out.println("  POST /process-payment  - Process payment or setup recurring");
            System.out.println("");
            System.out.println("Features:");
            System.out.println("  * One-time payments");
            System.out.println("  * Recurring/subscription payments");
            System.out.println("  * Customer and payment method storage");
            System.out.println("  * Payment Scheduler integration");
            System.out.println("  * StoredCredential for recurring transactions");
            System.out.println("  * Multiple frequencies: weekly, bi-weekly, monthly, quarterly, yearly");
            System.out.println("============================================================");
            System.out.println("");
        } catch (Exception e) {
            // If there's an error loading .env or displaying the banner, just continue
            // The application should still start successfully
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        // Cleanup if needed
    }
}
