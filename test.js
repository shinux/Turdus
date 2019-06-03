const Turdus = require('./index');
const assert = require('assert');
const nock = require('nock');
const bluebird = require('bluebird');

describe('test turdus', () => {

  beforeEach(async() => {
    nock.cleanAll();
  });

  it('should initialize raw turdus successfully', () => {
    const endpoints = ['127.0.0.1', '127.0.0.2', '127.0.0.3'];
    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint, turdus._endpoints[index]);
    });
  });

  it('should weighted turdus successfully initialized', async() => {

    const path = '/cat-cats';

    const endpoints = [
      { server: '127.0.0.1', weight: 5 },
      { server: '127.0.0.2', weight: 10 },
      { server: '127.0.0.3', weight: 4 },
    ];

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint.server)
      .persist()
      .get(path)
      .reply(200, 'hello world');
    });

    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint, turdus._endpoints[index]);
    });
    assert.equal(turdus._gcd, 1);

    const requestHosts = [];
    await bluebird.each(new Array(19), async() => {
      const result = await turdus.request({ uri: path, method: 'GET' });
      requestHosts.push(result.request.host);
    });

    endpoints.forEach((endpoint) => {
      assert.equal(requestHosts.filter((host) => host === endpoint.server).length, endpoint.weight);
    });
  });

  it('should weighted turdus successfully initialized back off to simple turdus', async() => {

    const path = '/cat-birds';

    const endpoints = [
      { server: '127.0.0.1', weight: 0 },
      { server: '127.0.0.2', weight: 0 },
      { server: '127.0.0.3', weight: 0 },
    ];

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint.server)
      .persist()
      .post(path)
      .reply(200, 'hello world');
    });

    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint.server, turdus._endpoints[index]);
    });
    assert.ok(!turdus._gcd);

    const requestHosts = [];
    await bluebird.each(new Array(6), async() => {
      const result = await turdus.request({
        uri: path,
        method: 'POST',
        body: { yy: 6 },
        json: true,
      });
      requestHosts.push(result.request.host);
    });

    endpoints.forEach((endpoint) => {
      assert.equal(requestHosts.filter((host) => host === endpoint.server).length, 2);
    });
  });


  it('should raw turdus successfully initialized and meet load balancing', async() => {
    const path = '/cat-dogs';

    const endpoints = ['127.0.0.1', '127.0.0.2', '127.0.0.3', '127.0.0.4'];

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint)
      .persist()
      .post(path)
      .reply(200, 'hello world');
    });

    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint, turdus._endpoints[index]);
    });
    assert.equal(!turdus._gcd, true);

    const requestHosts = [];
    await bluebird.each(new Array(8), async() => {
      const result = await turdus.request({
        uri: path,
        method: 'POST',
        body: { xx: 5 },
        json: true,
      });
      requestHosts.push(result.request.host);
    });

    endpoints.forEach((endpoint) => {
      assert.equal(requestHosts.filter((host) => host === endpoint).length, 2);
    });
  });

  it('should all weighted 0 turdus initialized successfully and act as raw does', async() => {
    const path = '/cat-birds';

    const endpoints = [
      { server: '127.0.0.1' },
      { server: '127.0.0.2' },
      { server: '127.0.0.3' },
      { server: '127.0.0.4' },
    ];

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint.server)
      .persist()
      .post(path)
      .reply(200, 'hello world');
    });

    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint.server, turdus._endpoints[index]);
    });
    assert.equal(!turdus._gcd, true);

    const requestHosts = [];
    await bluebird.each(new Array(8), async() => {
      const result = await turdus.request({
        uri: path,
        method: 'POST',
        body: { xx: 5 },
        json: true,
      });
      requestHosts.push(result.request.host);
    });

    endpoints.forEach((endpoint) => {
      assert.equal(requestHosts.filter((host) => host === endpoint.server).length, 2);
    });
  });


  it('should only one server be used due to only one positive weight', async() => {

    const path = '/cat-birds';

    const endpoints = [
      { server: '127.0.0.1', weight: 0 },
      { server: '127.0.0.2', weight: 5 },
      { server: '127.0.0.3', weight: 0 },
    ];

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint.server)
      .persist()
      .post(path)
      .reply(200, 'hello world');
    });

    const turdus = Turdus(endpoints);
    endpoints.forEach((endpoint, index) => {
      assert.equal(endpoint.server, turdus._endpoints[index].server);
    });

    const requestHosts = [];
    await bluebird.each(new Array(6), async() => {
      const result = await turdus.request({
        uri: path,
        method: 'POST',
        body: { yy: 6 },
        json: true,
      });
      requestHosts.push(result.request.host);
    });

    assert.equal(requestHosts.filter((host) => host !== endpoints[1].server).length, 0);
  });

  it('test fault tolerance success', async() => {
    const path = '/cat-birds';
    const message = 'though error';

    const endpoints = [
      { server: '127.0.0.1', weight: 0 },
      { server: '127.0.0.2', weight: 0 },
    ];
    const turdus = Turdus(endpoints);
    turdus.fakePositiveRes({
      [path]: message,
    });
    const result = await turdus.request({
      uri: path,
      method: 'POST',
      body: { yy: 6 },
      json: true,
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, message);
  });

  it('test fault tolerance fail because path not match', async() => {
    const path = '/cat-birds';
    const message = 'though error';

    const endpoints = [
      { server: '127.0.0.1', weight: 0 },
      { server: '127.0.0.2', weight: 0 },
    ];

    const realError = 'hello error';

    endpoints.forEach((endpoint) => {
      nock('http://' + endpoint.server)
      .persist()
      .post('/cat-cows')
      .reply(400, realError);
    });

    const turdus = Turdus(endpoints);
    turdus.fakePositiveRes({
      [path]: message,
    });
    try {
      await turdus.request({
        uri: '/cat-cows',
        method: 'POST',
        body: { yy: 6 },
        json: true,
      });
    } catch (err) {
      assert.equal(err.message, `Error occured during request: ${realError}`);
    }
  });

});
