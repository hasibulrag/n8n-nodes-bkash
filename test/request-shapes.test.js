// Offline tests: mock n8n's HTTP helpers and check the exact requests the
// node and credential send to bKash. Run with `npm test` (builds first).
// Uses only Node's built-in test runner, so no runtime or extra dev deps.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { BkashApi } = require('../dist/credentials/BkashApi.credentials.js');
const { Bkash } = require('../dist/nodes/Bkash/Bkash.node.js');

const SANDBOX = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

const fakeCredentials = {
	environment: 'sandbox',
	username: 'test-user',
	password: 'test-pass',
	appKey: 'test-app-key',
	appSecret: 'test-app-secret',
	idToken: 'cached-id-token',
};

/** Builds a minimal IExecuteFunctions mock. */
function mockExecuteFunctions({ params, response, continueOnFail = false, items = [{ json: {} }] }) {
	const calls = [];
	const ctx = {
		getInputData: () => items,
		getNodeParameter: (name, i, fallback) => {
			const p = Array.isArray(params) ? params[i] : params;
			if (name in p) return p[name];
			if (fallback !== undefined) return fallback;
			throw new Error(`Unexpected parameter: ${name}`);
		},
		getCredentials: async () => fakeCredentials,
		getNode: () => ({ name: 'bKash', type: 'n8n-nodes-bkash.bkash', typeVersion: 1, parameters: {} }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: async function (credentialName, options) {
				calls.push({ credentialName, options });
				return typeof response === 'function' ? response(options) : response;
			},
		},
	};
	return { ctx, calls };
}

test('credential: preAuthentication grants a token with the right request shape', async () => {
	const credential = new BkashApi();
	const calls = [];
	const helper = {
		helpers: {
			httpRequest: async (options) => {
				calls.push(options);
				return { statusCode: '0000', id_token: 'new-id-token', expires_in: 3600 };
			},
		},
	};

	const result = await credential.preAuthentication.call(helper, fakeCredentials);

	assert.deepEqual(result, { idToken: 'new-id-token' });
	assert.equal(calls.length, 1);
	const [req] = calls;
	assert.equal(req.method, 'POST');
	assert.equal(req.url, `${SANDBOX}/tokenized/checkout/token/grant`);
	assert.equal(req.headers.username, 'test-user');
	assert.equal(req.headers.password, 'test-pass');
	assert.deepEqual(req.body, { app_key: 'test-app-key', app_secret: 'test-app-secret' });
	assert.equal(req.timeout, 30000);
	assert.equal(req.json, true);
});

test('credential: production environment uses the production host', async () => {
	const credential = new BkashApi();
	let url;
	const helper = {
		helpers: {
			httpRequest: async (options) => {
				url = options.url;
				return { statusCode: '0000', id_token: 't' };
			},
		},
	};
	await credential.preAuthentication.call(helper, { ...fakeCredentials, environment: 'production' });
	assert.equal(url, 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant');
});

test('credential: failed grant throws with bKash statusMessage', async () => {
	const credential = new BkashApi();
	const helper = {
		helpers: { httpRequest: async () => ({ statusCode: '2079', statusMessage: 'Invalid username and password' }) },
	};
	await assert.rejects(
		credential.preAuthentication.call(helper, fakeCredentials),
		/2079.*Invalid username and password/,
	);
});

test('credential: idToken is hidden and expirable, authenticate injects headers', () => {
	const credential = new BkashApi();
	const idToken = credential.properties.find((p) => p.name === 'idToken');
	assert.equal(idToken.type, 'hidden');
	assert.equal(idToken.typeOptions.expirable, true);
	assert.deepEqual(credential.authenticate.properties.headers, {
		Authorization: '={{$credentials.idToken}}',
		'X-APP-Key': '={{$credentials.appKey}}',
	});
	assert.ok(credential.test.request.url);
});

test('node: Payment → Create sends mode 0011 checkout body', async () => {
	const node = new Bkash();
	const { ctx, calls } = mockExecuteFunctions({
		params: {
			resource: 'payment',
			operation: 'create',
			mode: '0011',
			amount: 500,
			currency: 'BDT',
			intent: 'sale',
			merchantInvoiceNumber: 'INV-1',
			callbackURL: 'https://example.com/webhook/bkash',
			payerReference: '01770618575',
			additionalFields: {},
		},
		response: { statusCode: '0000', paymentID: 'TR0011abc', bkashURL: 'https://sandbox.payment.bkash.com/?paymentId=TR0011abc' },
	});

	const [out] = await node.execute.call(ctx);

	assert.equal(calls.length, 1);
	const { credentialName, options } = calls[0];
	assert.equal(credentialName, 'bkashApi');
	assert.equal(options.method, 'POST');
	assert.equal(options.baseURL, SANDBOX);
	assert.equal(options.url, '/tokenized/checkout/create');
	assert.equal(options.timeout, 30000);
	assert.deepEqual(options.body, {
		mode: '0011',
		payerReference: '01770618575',
		callbackURL: 'https://example.com/webhook/bkash',
		amount: '500.00',
		currency: 'BDT',
		intent: 'sale',
		merchantInvoiceNumber: 'INV-1',
	});
	assert.equal(out[0].json.paymentID, 'TR0011abc');
	assert.deepEqual(out[0].pairedItem, { item: 0 });
});

test('node: Payment → Create with agreement sends mode 0001 and agreementID', async () => {
	const node = new Bkash();
	const { ctx, calls } = mockExecuteFunctions({
		params: {
			resource: 'payment',
			operation: 'create',
			mode: '0001',
			agreementID: 'AGR123',
			amount: 10.5,
			currency: 'BDT',
			intent: 'sale',
			merchantInvoiceNumber: 'INV-2',
			callbackURL: 'https://example.com/cb',
			payerReference: 'cust-9',
			additionalFields: {},
		},
		response: { statusCode: '0000' },
	});
	await node.execute.call(ctx);
	assert.equal(calls[0].options.body.mode, '0001');
	assert.equal(calls[0].options.body.agreementID, 'AGR123');
	assert.equal(calls[0].options.body.amount, '10.50');
});

test('node: Payment → Execute sends paymentID to the execute endpoint', async () => {
	const node = new Bkash();
	const { ctx, calls } = mockExecuteFunctions({
		params: { resource: 'payment', operation: 'execute', paymentID: ' TR0011abc ' },
		response: { statusCode: '0000', trxID: 'AB12CD34', transactionStatus: 'Completed' },
	});

	const [out] = await node.execute.call(ctx);

	assert.equal(calls[0].options.url, '/tokenized/checkout/execute');
	assert.deepEqual(calls[0].options.body, { paymentID: 'TR0011abc' });
	assert.equal(out[0].json.trxID, 'AB12CD34');
});

test('node: other operations hit the right endpoints', async () => {
	const cases = [
		[{ resource: 'payment', operation: 'query', paymentID: 'P1' }, '/tokenized/checkout/payment/status', { paymentID: 'P1' }],
		[{ resource: 'agreement', operation: 'create', payerReference: 'r', callbackURL: 'https://c' }, '/tokenized/checkout/create', { mode: '0000', payerReference: 'r', callbackURL: 'https://c' }],
		[{ resource: 'agreement', operation: 'execute', paymentID: 'P2' }, '/tokenized/checkout/execute', { paymentID: 'P2' }],
		[{ resource: 'agreement', operation: 'query', agreementID: 'A1' }, '/tokenized/checkout/agreement/status', { agreementID: 'A1' }],
		[{ resource: 'agreement', operation: 'cancel', agreementID: 'A1' }, '/tokenized/checkout/agreement/cancel', { agreementID: 'A1' }],
		[{ resource: 'transaction', operation: 'search', trxID: 'T1' }, '/tokenized/checkout/general/searchTransaction', { trxID: 'T1' }],
		[
			{ resource: 'transaction', operation: 'refund', paymentID: 'P3', trxID: 'T3', amount: 25, reason: 'damaged', sku: 'SKU-1' },
			'/tokenized/checkout/payment/refund',
			{ paymentID: 'P3', amount: '25.00', trxID: 'T3', sku: 'SKU-1', reason: 'damaged' },
		],
	];
	for (const [params, url, body] of cases) {
		const { ctx, calls } = mockExecuteFunctions({ params, response: { statusCode: '0000' } });
		await new Bkash().execute.call(ctx);
		assert.equal(calls[0].options.url, url, `${params.resource}.${params.operation}`);
		assert.deepEqual(calls[0].options.body, body, `${params.resource}.${params.operation}`);
	}
});

test('node: non-0000 statusCode throws NodeApiError with statusMessage', async () => {
	const { ctx } = mockExecuteFunctions({
		params: { resource: 'payment', operation: 'execute', paymentID: 'P1' },
		response: { statusCode: '2056', statusMessage: 'Invalid Payment State' },
	});
	await assert.rejects(new Bkash().execute.call(ctx), (error) => {
		assert.equal(error.constructor.name, 'NodeApiError');
		assert.match(error.message, /2056: Invalid Payment State/);
		return true;
	});
});

test('node: continueOnFail returns an error item per failed input and keeps going', async () => {
	let n = 0;
	const { ctx, calls } = mockExecuteFunctions({
		items: [{ json: {} }, { json: {} }],
		params: [
			{ resource: 'payment', operation: 'query', paymentID: 'BAD' },
			{ resource: 'payment', operation: 'query', paymentID: 'GOOD' },
		],
		continueOnFail: true,
		response: () =>
			n++ === 0
				? { statusCode: '2023', statusMessage: 'Insufficient Balance' }
				: { statusCode: '0000', transactionStatus: 'Completed' },
	});

	const [out] = await new Bkash().execute.call(ctx);

	assert.equal(calls.length, 2);
	assert.equal(out.length, 2);
	assert.match(out[0].json.error, /2023/);
	assert.equal(out[0].json.statusCode, '2023');
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	assert.equal(out[1].json.transactionStatus, 'Completed');
	assert.deepEqual(out[1].pairedItem, { item: 1 });
});

test('node: rejects a zero amount before calling bKash', async () => {
	const { ctx, calls } = mockExecuteFunctions({
		params: { resource: 'transaction', operation: 'refund', paymentID: 'P', trxID: 'T', amount: 0, reason: 'r', sku: 's' },
		response: { statusCode: '0000' },
	});
	await assert.rejects(new Bkash().execute.call(ctx), /Amount must be a number greater than 0/);
	assert.equal(calls.length, 0);
});
