import type { INodeProperties } from 'n8n-workflow';

const showForPayment = { resource: ['payment'] };

export const paymentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForPayment },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a payment and get the bKash URL to send the customer to',
				action: 'Create a payment',
			},
			{
				name: 'Execute',
				value: 'execute',
				description:
					'Complete a payment after the customer approves it. Use Query only if Execute fails or times out.',
				action: 'Execute a payment',
			},
			{
				name: 'Query',
				value: 'query',
				description: 'Get the current status of a payment',
				action: 'Query a payment',
			},
		],
		default: 'create',
	},
];

export const paymentFields: INodeProperties[] = [
	// ----------------------------------
	//         payment: create
	// ----------------------------------
	{
		displayName: 'Payment Mode',
		name: 'mode',
		type: 'options',
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		options: [
			{
				name: 'Checkout (Mode 0011)',
				value: '0011',
				description: 'One-time payment. The customer enters their wallet number, OTP and PIN.',
			},
			{
				name: 'With Agreement (Mode 0001)',
				value: '0001',
				description: 'Charge a wallet that already has an agreement. The customer enters only their PIN.',
			},
		],
		default: '0011',
		description: 'How the customer pays',
	},
	{
		displayName: 'Agreement ID',
		name: 'agreementID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['create'], mode: ['0001'] } },
		default: '',
		description: 'The agreementID returned by Agreement → Execute',
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
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		default: 0,
		description: 'Amount to charge, in Bangladeshi Taka (BDT)',
	},
	{
		displayName: 'Currency',
		name: 'currency',
		type: 'options',
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		options: [{ name: 'BDT', value: 'BDT' }],
		default: 'BDT',
		description: 'Currency of the payment. Only Bangladeshi Taka is supported.',
	},
	{
		displayName: 'Intent',
		name: 'intent',
		type: 'options',
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		options: [{ name: 'Sale', value: 'sale' }],
		default: 'sale',
		description: 'Payment intent. Tokenized Checkout supports sale only.',
	},
	{
		displayName: 'Merchant Invoice Number',
		name: 'merchantInvoiceNumber',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		default: '',
		placeholder: 'INV-2024-0001',
		description: 'Your own unique reference for this payment (max 255 characters)',
	},
	{
		displayName: 'Callback URL',
		name: 'callbackURL',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		default: '',
		placeholder: 'https://your-n8n.example.com/webhook/bkash-callback',
		description:
			'Where bKash sends the customer when they finish. bKash adds paymentID and status (success, failure or cancel) to the query string. A Webhook node URL works well here.',
	},
	{
		displayName: 'Payer Reference',
		name: 'payerReference',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		default: '',
		placeholder: '01XXXXXXXXX',
		description:
			"Your reference for the payer, for example their phone number or customer ID. bKash pre-fills it as the wallet number when it's a valid one.",
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		displayOptions: { show: { ...showForPayment, operation: ['create'] } },
		default: {},
		options: [
			{
				displayName: 'Merchant Association Info',
				name: 'merchantAssociationInfo',
				type: 'string',
				default: '',
				description: 'For aggregators only: the sub-merchant identifier bKash assigned (max 255 characters)',
			},
		],
	},

	// ----------------------------------
	//     payment: execute, query
	// ----------------------------------
	{
		displayName: 'Payment ID',
		name: 'paymentID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['execute'] } },
		default: '',
		placeholder: '={{ $json.query.paymentID }}',
		description:
			'The paymentID bKash added to your callback URL. Run Execute only when status is success. If Execute fails or times out, use Query to check whether the payment went through before retrying.',
	},
	{
		displayName: 'Payment ID',
		name: 'paymentID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForPayment, operation: ['query'] } },
		default: '',
		description: 'The paymentID returned by Create',
	},
];
