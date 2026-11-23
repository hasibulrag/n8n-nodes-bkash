import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { BKASH_SUCCESS_CODE, BKASH_TIMEOUT_MS, getBkashBaseUrl } from './constants';

/**
 * Sends one authenticated POST request to the bKash Tokenized Checkout API.
 *
 * The credential's `authenticate` block adds the `Authorization` and
 * `X-APP-Key` headers, and its `preAuthentication()` grants the token
 * (cached by n8n, see BkashApi.credentials.ts).
 *
 * bKash usually returns business errors with HTTP 200, so the body is
 * checked too: a `statusCode` other than "0000", or an `errorCode`, throws a
 * NodeApiError that carries bKash's own message.
 */
export async function bkashApiRequest(
	this: IExecuteFunctions,
	endpoint: string,
	body: IDataObject,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('bkashApi', itemIndex);

	const options: IHttpRequestOptions = {
		method: 'POST',
		baseURL: getBkashBaseUrl(credentials.environment),
		url: endpoint,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body,
		json: true,
		timeout: BKASH_TIMEOUT_MS,
	};

	let response: IDataObject;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'bkashApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	assertBkashSuccess.call(this, response, itemIndex);
	return response;
}

function assertBkashSuccess(this: IExecuteFunctions, response: IDataObject, itemIndex: number) {
	const statusCode = response?.statusCode as string | undefined;
	const errorCode = response?.errorCode as string | undefined;

	const failed =
		(statusCode !== undefined && String(statusCode) !== BKASH_SUCCESS_CODE) ||
		(errorCode !== undefined && errorCode !== null && String(errorCode) !== '');

	if (!failed) {
		return;
	}

	const code = String(statusCode ?? errorCode);
	const message =
		(response.statusMessage as string | undefined) ??
		(response.errorMessage as string | undefined) ??
		'bKash returned an error';

	throw new NodeApiError(this.getNode(), response as JsonObject, {
		itemIndex,
		message: `bKash error ${code}: ${message}`,
		description: `bKash returned statusCode "${code}" instead of "${BKASH_SUCCESS_CODE}". See the bKash error code list for details.`,
	});
}
