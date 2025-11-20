package com.globalpayments.xmlapi;

import java.io.StringReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Global Payments XML API Utilities
 *
 * Provides utility functions for XML API integration including:
 * - SHA-1 hash generation for request authentication
 * - Timestamp formatting
 * - XML request building
 * - XML response parsing
 * - Country code conversion
 */
public class XmlApiUtils {

    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Random RANDOM = new Random();

    /**
     * Generate timestamp in XML API format: YYYYMMDDHHMMSS
     */
    public static String generateTimestamp() {
        return LocalDateTime.now().format(TIMESTAMP_FORMATTER);
    }

    /**
     * Generate unique order ID
     */
    public static String generateOrderId(String prefix) {
        long timestamp = System.currentTimeMillis();
        int randomNum = RANDOM.nextInt(1000);
        return String.format("%s_%d_%d", prefix, timestamp, randomNum);
    }

    public static String generateOrderId() {
        return generateOrderId("ORD");
    }

    /**
     * Generate SHA-1 hash for XML API authentication
     *
     * XML API uses a two-step hashing process:
     * 1. Hash the concatenated request values
     * 2. Hash the result with the shared secret appended
     */
    public static String generateSha1Hash(String dataString, String sharedSecret) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");

            // First hash
            byte[] firstHashBytes = md.digest(dataString.getBytes(StandardCharsets.UTF_8));
            String firstHash = bytesToHex(firstHashBytes);

            // Second hash with shared secret
            String secondString = firstHash + "." + sharedSecret;
            byte[] secondHashBytes = md.digest(secondString.getBytes(StandardCharsets.UTF_8));
            String finalHash = bytesToHex(secondHashBytes);

            return finalHash;
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-1 algorithm not available", e);
        }
    }

    /**
     * Convert byte array to hex string
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }

    /**
     * Generate hash for payer-new request
     */
    public static String generatePayerNewHash(Map<String, String> params, String sharedSecret) {
        String dataString = String.format("%s.%s.%s...%s",
            params.get("timestamp"),
            params.get("merchantId"),
            params.get("orderId"),
            params.get("payerRef")
        );
        return generateSha1Hash(dataString, sharedSecret);
    }

    /**
     * Generate hash for card-new request
     */
    public static String generateCardNewHash(Map<String, String> params, String sharedSecret) {
        String dataString = String.format("%s.%s.%s...%s.%s.%s",
            params.get("timestamp"),
            params.get("merchantId"),
            params.get("orderId"),
            params.get("payerRef"),
            params.get("chname"),
            params.get("cardNumber")
        );
        return generateSha1Hash(dataString, sharedSecret);
    }

    /**
     * Generate hash for receipt-in (stored card payment) request
     */
    public static String generateStoredCardPaymentHash(Map<String, String> params, String sharedSecret) {
        String dataString = String.format("%s.%s.%s.%s.%s.%s",
            params.get("timestamp"),
            params.get("merchantId"),
            params.get("orderId"),
            params.get("amount"),
            params.get("currency"),
            params.get("payerRef")
        );
        return generateSha1Hash(dataString, sharedSecret);
    }

    /**
     * Generate hash for schedule-new request
     */
    public static String generateScheduleHash(Map<String, String> params, String sharedSecret) {
        String dataString = String.format("%s.%s.%s.%s.%s.%s.%s",
            params.get("timestamp"),
            params.get("merchantId"),
            params.get("scheduleRef"),
            params.get("amount"),
            params.get("currency"),
            params.get("payerRef"),
            params.get("schedule")
        );
        return generateSha1Hash(dataString, sharedSecret);
    }

    /**
     * Convert dollar amount to cents
     */
    public static int convertToCents(double amount) {
        return (int) Math.round(amount * 100);
    }

    /**
     * Convert cents to dollars
     */
    public static double convertFromCents(int cents) {
        return cents / 100.0;
    }

    /**
     * Sanitize postal code
     */
    public static String sanitizePostalCode(String postalCode) {
        if (postalCode == null || postalCode.isEmpty()) {
            return "";
        }
        return postalCode.replace(" ", "").replace("-", "").substring(0, Math.min(postalCode.length(), 16));
    }

    /**
     * Sanitize alphanumeric string
     */
    public static String sanitizeAlphanumeric(String value, int maxLength) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        // Remove any potentially problematic characters
        String sanitized = value.replaceAll("[^a-zA-Z0-9 .,@_-]", "");
        return sanitized.substring(0, Math.min(sanitized.length(), maxLength));
    }

    public static String sanitizeAlphanumeric(String value) {
        return sanitizeAlphanumeric(value, 255);
    }

    /**
     * Map frequency to schedule format
     */
    public static String mapFrequencyToSchedule(String frequency) {
        Map<String, String> frequencyMap = new HashMap<>();
        frequencyMap.put("weekly", "weekly");
        frequencyMap.put("bi-weekly", "biweekly");
        frequencyMap.put("biweekly", "biweekly");
        frequencyMap.put("monthly", "monthly");
        frequencyMap.put("quarterly", "quarterly");
        frequencyMap.put("yearly", "yearly");
        frequencyMap.put("annually", "yearly");

        return frequencyMap.getOrDefault(frequency.toLowerCase(), "monthly");
    }

    /**
     * Get XML API endpoint based on environment
     */
    public static String getXmlApiEndpoint(String environment) {
        if ("production".equals(environment)) {
            return "https://api.realexpayments.com/epage-remote.cgi";
        }
        return "https://api.sandbox.realexpayments.com/epage-remote.cgi";
    }

    public static String getXmlApiEndpoint() {
        return getXmlApiEndpoint("sandbox");
    }

    /**
     * Convert ISO 3166-1 numeric country code to alpha-2 code
     * HPP uses numeric codes (e.g., "840"), but XML API uses alpha-2 codes (e.g., "US")
     */
    public static String convertCountryCodeToAlpha2(String numericCode) {
        Map<String, String> countryCodeMap = new HashMap<>();
        countryCodeMap.put("036", "AU"); // Australia
        countryCodeMap.put("124", "CA"); // Canada
        countryCodeMap.put("276", "DE"); // Germany
        countryCodeMap.put("372", "IE"); // Ireland
        countryCodeMap.put("826", "GB"); // United Kingdom
        countryCodeMap.put("840", "US"); // United States
        countryCodeMap.put("250", "FR"); // France
        countryCodeMap.put("380", "IT"); // Italy
        countryCodeMap.put("724", "ES"); // Spain
        countryCodeMap.put("528", "NL"); // Netherlands
        countryCodeMap.put("056", "BE"); // Belgium
        countryCodeMap.put("208", "DK"); // Denmark
        countryCodeMap.put("246", "FI"); // Finland
        countryCodeMap.put("578", "NO"); // Norway
        countryCodeMap.put("752", "SE"); // Sweden
        countryCodeMap.put("756", "CH"); // Switzerland
        countryCodeMap.put("040", "AT"); // Austria
        countryCodeMap.put("620", "PT"); // Portugal
        countryCodeMap.put("616", "PL"); // Poland
        countryCodeMap.put("203", "CZ"); // Czech Republic

        // If already alpha-2 (2 characters), return as-is
        if (numericCode != null && numericCode.length() == 2) {
            return numericCode.toUpperCase();
        }

        // Convert numeric to alpha-2
        return countryCodeMap.getOrDefault(numericCode, "US");
    }

    /**
     * Build XML request string from Map
     */
    public static String buildXmlRequest(String requestType, Map<String, Object> requestData) {
        try {
            DocumentBuilderFactory docFactory = DocumentBuilderFactory.newInstance();
            DocumentBuilder docBuilder = docFactory.newDocumentBuilder();
            Document doc = docBuilder.newDocument();

            Element rootElement = doc.createElement("request");
            rootElement.setAttribute("type", requestType);
            rootElement.setAttribute("timestamp", (String) requestData.get("timestamp"));
            doc.appendChild(rootElement);

            // Add elements from requestData
            addElementsToXml(doc, rootElement, requestData);

            // Convert Document to String
            TransformerFactory transformerFactory = TransformerFactory.newInstance();
            Transformer transformer = transformerFactory.newTransformer();
            transformer.setOutputProperty(OutputKeys.INDENT, "no");
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");

            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(doc), new StreamResult(writer));

            return writer.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to build XML request", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static void addElementsToXml(Document doc, Element parent, Map<String, Object> data) {
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            // Skip special keys
            if ("timestamp".equals(key)) continue;

            if (value instanceof Map) {
                Element element = doc.createElement(key);
                parent.appendChild(element);
                addElementsToXml(doc, element, (Map<String, Object>) value);
            } else if (value instanceof String) {
                Element element = doc.createElement(key);
                element.setTextContent((String) value);
                parent.appendChild(element);
            }
        }
    }

    /**
     * Parse XML response string
     */
    public static Map<String, Object> parseXmlResponse(String xmlString) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new InputSource(new StringReader(xmlString)));

            Element root = doc.getDocumentElement();
            return elementToMap(root);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse XML response", e);
        }
    }

    private static Map<String, Object> elementToMap(Element element) {
        Map<String, Object> result = new HashMap<>();

        // Add attributes
        if (element.hasAttributes()) {
            for (int i = 0; i < element.getAttributes().getLength(); i++) {
                Node attr = element.getAttributes().item(i);
                result.put(attr.getNodeName(), attr.getNodeValue());
            }
        }

        // Add child elements
        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                Element childElement = (Element) child;
                String key = childElement.getTagName();

                // If child has children, recurse
                if (childElement.hasChildNodes() && childElement.getElementsByTagName("*").getLength() > 0) {
                    result.put(key, elementToMap(childElement));
                } else {
                    result.put(key, childElement.getTextContent());
                }
            }
        }

        return result;
    }

    /**
     * Normalize card expiry format
     */
    public static Map<String, String> normalizeCardExpiry(Map<String, String> cardDetails) {
        if (cardDetails == null) {
            return cardDetails;
        }

        Map<String, String> normalized = new HashMap<>(cardDetails);

        // Extract month
        String month = cardDetails.getOrDefault("expMonth",
                      cardDetails.getOrDefault("expmonth",
                      cardDetails.getOrDefault("exp_month",
                      cardDetails.getOrDefault("EXPMONTH", ""))));

        // Extract year
        String year = cardDetails.getOrDefault("expYear",
                     cardDetails.getOrDefault("expyear",
                     cardDetails.getOrDefault("exp_year",
                     cardDetails.getOrDefault("EXPYEAR", ""))));

        // Normalize year to 2 digits
        if (!year.isEmpty() && year.length() == 4) {
            year = year.substring(2);
        }

        if (!month.isEmpty()) {
            normalized.put("expmonth", String.format("%02d", Integer.parseInt(month)));
            normalized.remove("expMonth");
            normalized.remove("exp_month");
            normalized.remove("EXPMONTH");
        }

        if (!year.isEmpty()) {
            normalized.put("expyear", String.format("%02d", Integer.parseInt(year)));
            normalized.remove("expYear");
            normalized.remove("exp_year");
            normalized.remove("EXPYEAR");
        }

        return normalized;
    }
}
