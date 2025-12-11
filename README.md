# Global Payments XML API - Recurring Payments Examples

This repository provides working examples of recurring payment processing using the Global Payments XML API. Each implementation demonstrates one-time payments, subscription setup, customer storage, and automated billing schedules.

## Available Implementations

- [.NET Core](./dotnet/) - ASP.NET Core web application
- [Java](./java/) - Jakarta EE servlet-based web application
- [Node.js](./nodejs/) - Express.js web application
- [PHP](./php/) - PHP web application

## Features

- One-time payment processing
- Recurring payment setup with Payment Scheduler
- Customer and payment method storage
- StoredCredential implementation for recurring transactions
- Multiple billing frequencies (weekly, bi-weekly, monthly, quarterly, yearly)
- Hosted Payment Page (HPP) integration
- XML API implementation

## Quick Start

1. Choose your preferred language implementation
2. Navigate to the language directory (nodejs, php, java, or dotnet)
3. Copy `.env.sample` to `.env` and add your XML API credentials
4. Run `./run.sh` to install dependencies and start the server
5. Open your browser to the displayed URL

## Prerequisites

- Global Payments account with XML API credentials (Merchant ID and Shared Secret)
- Development environment for your chosen language
- Package manager (npm, composer, maven, or dotnet)

## Project Structure

Each implementation includes:
- Payment processing server with XML API integration
- Payment utilities for one-time and recurring payments
- XML API utilities for authentication and request building
- HTML payment form with client-side validation
- Environment-based configuration

## Security Notes

These examples demonstrate core implementation patterns. For production use:
- Implement comprehensive input validation
- Add rate limiting and security headers
- Use HTTPS for all communications
- Follow PCI compliance requirements
- Implement proper logging and monitoring
- Secure credential storage
