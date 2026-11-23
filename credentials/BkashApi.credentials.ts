import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestHelper,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

import {
	BKASH_BASE_URLS,
	BKASH_ENDPOINTS,
	BKASH_TIMEOUT_MS,
	getBkashBaseUrl,
} from '../nodes/Bkash/constants';

/**
 * bKash Tokenized Checkout credentials.
 *
 * Token handling: bKash `id_token` values live for 3600 seconds, and the
 * grant/refresh endpoints must not be called more than twice per hour or
 * the merchant app is blocked for an hour. The token is kept in the hidden
 * `idToken` field, marked `expirable`. n8n stores it with the credential and
 * calls `preAuthentication()` again only when the field is empty or a
 * request comes back with HTTP 401, so a new token is requested about once
 * per hour at most.
 */
export class BkashApi implements ICredentialType {
	name = 'bkashApi';

	displayName = 'bKash API';

	icon: Icon = {
		light: 'file:../nodes/Bkash/bkash.svg',
		dark: 'file:../nodes/Bkash/bkash.dark.svg',
	};

	documentationUrl = 'https://github.com/hasibulrag/n8n-nodes-bkash?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Sandbox',
					value: 'sandbox',
					description: BKASH_BASE_URLS.sandbox,
				},
				{
					name: 'Production',
					value: 'production',
					description: BKASH_BASE_URLS.production,
				},
			],
			default: 'sandbox',
			description: 'Which bKash environment to call',
		},
		{
			displayName: 'ID Token',
			name: 'idToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
			},
			default: '',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Merchant API username from bKash',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Merchant API password from bKash',
		},
		{
			displayName: 'App Key',
			name: 'appKey',
			type: 'string',
			default: '',
			required: true,
			description: 'The app_key bKash issued for your merchant app',
		},
		{
			displayName: 'App Secret',
			name: 'appSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'The app_secret bKash issued for your merchant app',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: `${getBkashBaseUrl(credentials.environment)}${BKASH_ENDPOINTS.grant}`,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				username: credentials.username as string,
				password: credentials.password as string,
			},
			body: {
				app_key: credentials.appKey,
				app_secret: credentials.appSecret,
			},
			json: true,
			timeout: BKASH_TIMEOUT_MS,
		})) as IDataObject;

		const idToken = response?.id_token;
		if (typeof idToken !== 'string' || idToken === '') {
			const statusCode = (response?.statusCode as string | undefined) ?? 'unknown';
			const statusMessage =
				(response?.statusMessage as string | undefined) ?? 'No id_token in the response';
			throw new Error(`bKash token grant failed (${statusCode}): ${statusMessage}`);
		}

		return { idToken };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.idToken}}',
				'X-APP-Key': '={{$credentials.appKey}}',
			},
		},
	};

	// Queries a payment ID that does not exist. bKash answers with HTTP 200
	// and a "payment not found" statusCode when the token and app key are
	// valid, and with HTTP 401/403 when they are not.
	test: ICredentialTestRequest = {
		request: {
			baseURL: `={{$credentials.environment === "production" ? "${BKASH_BASE_URLS.production}" : "${BKASH_BASE_URLS.sandbox}"}}`,
			url: BKASH_ENDPOINTS.paymentStatus,
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: {
				paymentID: 'n8n-credential-test',
			},
			json: true,
			timeout: BKASH_TIMEOUT_MS,
		},
	};
}
