// CloudFront Function (cloudfront-js-2.0), viewer request on the demo host's /_launch/* (research R20,
// contracts/assets-cdn.md "Demo host").
//
//   GET /_launch/<id>/<entry path>?p=<CloudFront-Policy>&s=<CloudFront-Signature>&k=<CloudFront-Key-Pair-Id>
//
// The session function signed the three values for https://<demo host>/<id>/* (12 hours). This
// function only moves them into cookies scoped to /<id>/ and redirects to the demo. It verifies
// nothing: CloudFront checks the cookies against the key group on every demo request, so a
// forged or altered value gets a 403 there. It never touches the origin.
//
// The cookies are set while the demo host is the top-level site, so they're first-party in every
// browser. No imports or exports (CloudFront Functions allow neither), so the tests load this file
// as text.

// Matches DEMO_SESSION_SECONDS in session-handler.ts.
var MAX_AGE_SECONDS = 43200;
var LAUNCH_PATH = /^\/_launch\/([A-Za-z0-9-]{1,64})\/([^\/\\].*)$/;
// CloudFront's URL-safe base64 (+ → -, = → _, / → ~) and key-pair IDs.
var COOKIE_VALUE = /^[A-Za-z0-9_~-]{1,4096}$/;

function badRequest() {
  return {
    statusCode: 400,
    statusDescription: 'Bad Request',
    headers: { 'cache-control': { value: 'no-store' } },
  };
}

function param(querystring, name) {
  var entry = querystring[name];
  var value = entry && entry.value;
  return typeof value === 'string' && COOKIE_VALUE.test(value) ? value : null;
}

// CloudFront calls `handler` by name.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var match = LAUNCH_PATH.exec(request.uri);
  if (!match) return badRequest();

  var policy = param(request.querystring, 'p');
  var signature = param(request.querystring, 's');
  var keyPairId = param(request.querystring, 'k');
  if (!policy || !signature || !keyPairId) return badRequest();

  var id = match[1];
  // Only this demo's requests carry them, so one demo never receives another's cookies.
  var attributes = 'Path=/' + id + '/; Secure; HttpOnly; SameSite=Lax; Max-Age=' + MAX_AGE_SECONDS;
  return {
    statusCode: 302,
    statusDescription: 'Found',
    headers: {
      // Starts with /<id>/, so it can't point at another host. The entry path stays as the browser
      // encoded it.
      location: { value: '/' + id + '/' + match[2] },
      'cache-control': { value: 'no-store' },
    },
    cookies: {
      'CloudFront-Policy': { value: policy, attributes: attributes },
      'CloudFront-Signature': { value: signature, attributes: attributes },
      'CloudFront-Key-Pair-Id': { value: keyPairId, attributes: attributes },
    },
  };
}
