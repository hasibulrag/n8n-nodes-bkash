import type { INodeProperties } from 'n8n-workflow';

const showForAgreement = { resource: ['agreement'] };

export const agreementOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForAgreement },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Cancel an agreement so the wallet can no longer be charged with it',
				action: 'Cancel an agreement',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Start linking a customer wallet and get the bKash URL to send them to',
				action: 'Create an agreement',
			},
			{
				name: 'Execute',
				value: 'execute',
				description: 'Finish linking the wallet after the customer approves it and get the agreementID',
				action: 'Execute an agreement',
			},
			{
				name: 'Query',
				value: 'query',
				description: 'Get the current status of an agreement',
				action: 'Query an agreement',
			},
		],
		default: 'create',
	},
];

export const agreementFields: INodeProperties[] = [
	// ----------------------------------
	//        agreement: create
	// ----------------------------------
	{
		displayName: 'Callback URL',
		name: 'callbackURL',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForAgreement, operation: ['create'] } },
		default: '',
		placeholder: 'https://your-n8n.example.com/webhook/bkash-agreement',
		description:
			'Where bKash sends the customer when they finish. bKash adds paymentID and status to the query string.',
	},
	{
		displayName: 'Payer Reference',
		name: 'payerReference',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForAgreement, operation: ['create'] } },
		default: '',
		placeholder: '01XXXXXXXXX',
		description: 'Your reference for the payer, for example their phone number or customer ID',
	},

	// ----------------------------------
	//        agreement: execute
	// ----------------------------------
	{
		displayName: 'Payment ID',
		name: 'paymentID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForAgreement, operation: ['execute'] } },
		default: '',
		placeholder: '={{ $json.query.paymentID }}',
		description: 'The paymentID bKash added to your callback URL after Agreement → Create',
	},

	// ----------------------------------
	//    agreement: query, cancel
	// ----------------------------------
	{
		displayName: 'Agreement ID',
		name: 'agreementID',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForAgreement, operation: ['query', 'cancel'] } },
		default: '',
		description: 'The agreementID returned by Agreement → Execute',
	},
];
