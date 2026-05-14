/**
 * Hanar outbound email — use {@link sendHanarEmail} for raw sends, or transactional helpers below.
 */

export {
  sendHanarEmail,
  type HanarEmailTag,
  type SendHanarEmailParams,
  type SendHanarEmailResult,
} from './sendHanarEmail';

export {
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
  sendBusinessOnHoldEmail,
  sendMarketplaceApprovedEmail,
  sendPaymentReceiptEmail,
} from './transactional';

export { buildBusinessApprovedEmail, type BusinessApprovedTemplateProps } from './templates/businessApproved';
export { buildBusinessRejectedEmail, type BusinessRejectedTemplateProps } from './templates/businessRejected';
export { buildBusinessOnHoldEmail, type BusinessOnHoldTemplateProps } from './templates/businessOnHold';
export {
  buildMarketplaceApprovedEmail,
  type MarketplaceApprovedTemplateProps,
} from './templates/marketplaceApproved';
export { buildPaymentReceiptEmail, type PaymentReceiptTemplateProps } from './templates/paymentReceipt';
