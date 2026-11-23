/**
 * bKash Tokenized Checkout API (v1.2.0-beta) base URLs.
 *
 * TODO: The production URL below is the one used by existing bKash
 * v1.2.0-beta integrations. It could not be confirmed on developer.bka.sh,
 * which currently documents only the newer `/v2/tokenized-checkout` API.
 * Confirm it with the production credentials bKash sends you before going
 * live.
 */
export const BKASH_BASE_URLS = {
	sandbox: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
	production: 'https://tokenized.pay.bka.sh/v1.2.0-beta',
} as const;

export type BkashEnvironment = keyof typeof BKASH_BASE_URLS;

/** bKash closes requests that run longer than 30 seconds. */
export const BKASH_TIMEOUT_MS = 30_000;

/** `statusCode` value bKash returns for a successful call. */
export const BKASH_SUCCESS_CODE = '0000';

export const BKASH_ENDPOINTS = {
	grant: '/tokenized/checkout/token/grant',
	create: '/tokenized/checkout/create',
	execute: '/tokenized/checkout/execute',
	paymentStatus: '/tokenized/checkout/payment/status',
	agreementStatus: '/tokenized/checkout/agreement/status',
	agreementCancel: '/tokenized/checkout/agreement/cancel',
	searchTransaction: '/tokenized/checkout/general/searchTransaction',
	refund: '/tokenized/checkout/payment/refund',
} as const;

export function getBkashBaseUrl(environment: unknown): string {
	return environment === 'production' ? BKASH_BASE_URLS.production : BKASH_BASE_URLS.sandbox;
}
