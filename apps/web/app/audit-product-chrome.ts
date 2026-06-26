import type { Metadata } from "next";

import { auditTrailProduct } from "@auditrail/domain/audit-events";

export function getAuditTrailMetadata(): Metadata {
  return {
    description: auditTrailProduct.appChrome.metadataDescription,
    title: auditTrailProduct.appChrome.metadataTitle
  };
}

export function getAuditTrailLoadingLabel() {
  return auditTrailProduct.appChrome.loadingLabel;
}

export function getAuditTrailErrorHeading() {
  return auditTrailProduct.appChrome.errorHeading;
}
