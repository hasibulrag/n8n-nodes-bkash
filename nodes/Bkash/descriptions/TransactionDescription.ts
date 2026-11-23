import type { INodeProperties } from 'n8n-workflow';

const showForTransaction = { resource: ['transaction'] };

export const transactionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForTransaction },
		options: [
			{
				name: 'Refund',
				value: 'refund',
				description: 'Refund all or part of a completed payment',
				action: 'Refund a transaction',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Get the details of a transaction by its trxID',
				action: 'Search a transaction',
			},
		],
		default: 'search',
	},
];

export const transactionFields: INodeProperties[] = [
	// ----------------------------------
	//       transaction: search
	// ----------------------------------
	{
		displayName: 'Transaction ID',
		name: 'trxID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForTransaction, operation: ['search'] } },
		default: '',
		description: 'The trxID returned by Payment → Execute',
	},

	// ----------------------------------
	//       transaction: refund
	// ----------------------------------
	{
		displayName: 'Payment ID',
		name: 'paymentID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForTransaction, operation: ['refund'] } },
		default: '',
		description: 'The paymentID of the payment to refund',
	},
	{
		displayName: 'Transaction ID',
		name: 'trxID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForTransaction, operation: ['refund'] } },
		default: '',
		description: 'The trxID of the payment to refund',
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'number',
		required: true,
		typeOptions: {
			minValue: 0.01,
			numberPrecision: 2,
		},
		displayOptions: { show: { ...showForTransaction, operation: ['refund'] } },
		default: 0,
		description: 'Amount to refund in BDT. It cannot be more than the amount still refundable.',
	},
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForTransaction, operation: ['refund'] } },
		default: '',
		placeholder: 'Customer returned the item',
		description: 'Why you are refunding (max 255 characters)',
	},
	{
		displayName: 'SKU',
		name: 'sku',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForTransaction, operation: ['refund'] } },
		default: '',
		placeholder: 'SKU-123',
		description: 'Product or service identifier for the refund (max 255 characters)',
	},
];
