import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { BKASH_ENDPOINTS } from './constants';
import { bkashApiRequest } from './GenericFunctions';
import { agreementFields, agreementOperations } from './descriptions/AgreementDescription';
import { paymentFields, paymentOperations } from './descriptions/PaymentDescription';
import { transactionFields, transactionOperations } from './descriptions/TransactionDescription';

/**
 * Programmatic style is used because the credential's token grant has to be
 * rate limited (see BkashApi.credentials.ts), the base URL depends on a
 * credential value, and every response body needs a bKash statusCode check
 * that also has to work with "Continue On Fail".
 */
export class Bkash implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'bKash',
		name: 'bkash',
		icon: { light: 'file:bkash.svg', dark: 'file:bkash.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Accept and refund payments with the bKash Tokenized Checkout API (unofficial)',
		defaults: {
			name: 'bKash',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'bkashApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Agreement', value: 'agreement' },
					{ name: 'Payment', value: 'payment' },
					{ name: 'Transaction', value: 'transaction' },
				],
				default: 'payment',
			},
			...paymentOperations,
			...paymentFields,
			...agreementOperations,
			...agreementFields,
			...transactionOperations,
			...transactionFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const { endpoint, body } = buildRequest.call(this, resource, operation, i);

				const responseData = await bkashApiRequest.call(this, endpoint, body, i);

				returnData.push({
					json: responseData,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
							...extractBkashError(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors hand back the same instance when given an error of
				// their own class, so already-wrapped errors keep their HTTP context.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						itemIndex: i,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

interface BkashRequest {
	endpoint: string;
	body: IDataObject;
}

function buildRequest(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): BkashRequest {
	const param = (name: string) => (this.getNodeParameter(name, i) as string).trim();

	if (resource === 'payment') {
		if (operation === 'create') {
			const mode = this.getNodeParameter('mode', i) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const body: IDataObject = {
				mode,
				payerReference: param('payerReference'),
				callbackURL: param('callbackURL'),
				amount: formatAmount.call(this, this.getNodeParameter('amount', i) as number, i),
				currency: this.getNodeParameter('currency', i) as string,
				intent: this.getNodeParameter('intent', i) as string,
				merchantInvoiceNumber: param('merchantInvoiceNumber'),
			};
			if (mode === '0001') {
				body.agreementID = param('agreementID');
			}
			if (additionalFields.merchantAssociationInfo) {
				body.merchantAssociationInfo = additionalFields.merchantAssociationInfo;
			}
			return { endpoint: BKASH_ENDPOINTS.create, body };
		}
		if (operation === 'execute') {
			return { endpoint: BKASH_ENDPOINTS.execute, body: { paymentID: param('paymentID') } };
		}
		if (operation === 'query') {
			return { endpoint: BKASH_ENDPOINTS.paymentStatus, body: { paymentID: param('paymentID') } };
		}
	}

	if (resource === 'agreement') {
		if (operation === 'create') {
			return {
				endpoint: BKASH_ENDPOINTS.create,
				body: {
					mode: '0000',
					payerReference: param('payerReference'),
					callbackURL: param('callbackURL'),
				},
			};
		}
		if (operation === 'execute') {
			return { endpoint: BKASH_ENDPOINTS.execute, body: { paymentID: param('paymentID') } };
		}
		if (operation === 'query') {
			return {
				endpoint: BKASH_ENDPOINTS.agreementStatus,
				body: { agreementID: param('agreementID') },
			};
		}
		if (operation === 'cancel') {
			return {
				endpoint: BKASH_ENDPOINTS.agreementCancel,
				body: { agreementID: param('agreementID') },
			};
		}
	}

	if (resource === 'transaction') {
		if (operation === 'search') {
			return { endpoint: BKASH_ENDPOINTS.searchTransaction, body: { trxID: param('trxID') } };
		}
		if (operation === 'refund') {
			return {
				endpoint: BKASH_ENDPOINTS.refund,
				body: {
					paymentID: param('paymentID'),
					amount: formatAmount.call(this, this.getNodeParameter('amount', i) as number, i),
					trxID: param('trxID'),
					sku: param('sku'),
					reason: param('reason'),
				},
			};
		}
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for resource "${resource}"`,
		{ itemIndex: i },
	);
}

function formatAmount(this: IExecuteFunctions, amount: number, i: number): string {
	if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
		throw new NodeOperationError(this.getNode(), 'Amount must be a number greater than 0', {
			itemIndex: i,
			description: `Received: ${String(amount)}`,
		});
	}
	return amount.toFixed(2);
}

/** Keeps bKash's statusCode and statusMessage on the output item when Continue On Fail is on. */
function extractBkashError(error: unknown): IDataObject {
	const cause = (error as { cause?: unknown; errorResponse?: unknown })?.errorResponse ??
		(error as { cause?: unknown })?.cause;
	if (cause && typeof cause === 'object') {
		const { statusCode, statusMessage, errorCode, errorMessage } = cause as IDataObject;
		const details: IDataObject = {};
		if (statusCode !== undefined) details.statusCode = statusCode;
		if (statusMessage !== undefined) details.statusMessage = statusMessage;
		if (errorCode !== undefined) details.errorCode = errorCode;
		if (errorMessage !== undefined) details.errorMessage = errorMessage;
		return details;
	}
	return {};
}
