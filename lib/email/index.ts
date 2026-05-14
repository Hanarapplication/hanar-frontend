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
  sendMarketplaceOnHoldEmail,
  sendMarketplaceRejectedEmail,
  sendMarketplaceSubmittedEmail,
  sendBannerApprovedEmail,
  sendBannerOnHoldEmail,
  sendBannerPaymentReceivedEmail,
  sendBannerRejectedEmail,
  sendBannerSubmittedEmail,
  sendPaymentReceiptEmail,
} from './transactional';

export { buildBusinessApprovedEmail, type BusinessApprovedTemplateProps } from './templates/businessApproved';
export { buildBusinessRejectedEmail, type BusinessRejectedTemplateProps } from './templates/businessRejected';
export { buildBusinessOnHoldEmail, type BusinessOnHoldTemplateProps } from './templates/businessOnHold';
export {
  buildMarketplaceApprovedEmail,
  type MarketplaceApprovedTemplateProps,
} from './templates/marketplaceApproved';
export { buildMarketplaceOnHoldEmail, type MarketplaceOnHoldTemplateProps } from './templates/marketplaceOnHold';
export { buildMarketplaceRejectedEmail, type MarketplaceRejectedTemplateProps } from './templates/marketplaceRejected';
export {
  buildMarketplaceSubmittedEmail,
  type MarketplaceSubmittedTemplateProps,
} from './templates/marketplaceSubmitted';
export { buildBannerApprovedEmail, type BannerApprovedTemplateProps } from './templates/bannerApproved';
export { buildBannerOnHoldEmail, type BannerOnHoldTemplateProps } from './templates/bannerOnHold';
export {
  buildBannerPaymentReceivedEmail,
  type BannerPaymentReceivedTemplateProps,
} from './templates/bannerPaymentReceived';
export { buildBannerRejectedEmail, type BannerRejectedTemplateProps } from './templates/bannerRejected';
export { buildBannerSubmittedEmail, type BannerSubmittedTemplateProps } from './templates/bannerSubmitted';
export { buildPaymentReceiptEmail, type PaymentReceiptTemplateProps } from './templates/paymentReceipt';
