import type { BillingProvider } from "@auditrail/domain/billing";

export class BillingProviderNotConfiguredError extends Error {
  constructor(provider: BillingProvider) {
    super(`billing_provider_not_configured:${provider}`);
    this.name = "BillingProviderNotConfiguredError";
  }
}

export class BillingCustomerNotFoundError extends Error {
  constructor() {
    super("billing_customer_not_found");
    this.name = "BillingCustomerNotFoundError";
  }
}
