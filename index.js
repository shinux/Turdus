const _ = require('lodash');
const bluebird = require('bluebird');
const realRequest = bluebird.promisify(require('request'));


class RawTurdus {
  constructor(endpoints) {
    this._endpoints = endpoints || [];
    this._index = 0;
  }

  /**
   * @Private
   *
   * pick endpoint from ipList then update index.
   */
  pickEndpoint() {
    if (this._index >= this._endpoints.length) {
      this._index = 0;
    }
    const currentEndpoint = this._endpoints[this._index];
    this._index++;
    return currentEndpoint;
  }

  async request(options) {
    try {
      const server = this.pickEndpoint();
      // TODO: more parse on protocol and domain
      options.uri = 'http://' + server + options.uri;
      return await realRequest(options);
    } catch (err) {
      throw new Error('Error occured during request: ', err.message);
    }
  }
}

const gcd = (a, b) => !b ? a : gcd(b, a % b);


class WeightedTurdus extends RawTurdus {
  constructor(endpoints) {
    super(endpoints);
    if (this._endpoints.every((endpoint) => !endpoint.weight || endpoint.weight === 0)) {
      this._endpoints = this._endpoints.map((endpoint) => endpoint.server);
      this.raw = true;
    } else {
      this.restoreCurrentWeight();
      this._gcd = WeightedTurdus.calculateGCD(this._endpoints.map((server) => server.weight));
    }
  }

  static calculateGCD(numbers) {
    let currentGCD = numbers.pop();
    numbers.forEach((num) => {
      currentGCD = gcd(num, currentGCD);
    });
    return currentGCD;
  }

  /**
   * @private
   *
   */
  restoreCurrentWeight() {
    this._endpoints = this._endpoints.map((server) => {
      server.currentWeight = server.weight;
      return server;
    });
  }

  /**
   * @Private
   *
   * pick server ip/domain from _endpiontList then update index.
   *
   * @return {String|undefined}
   */
  pickEndpoint() {
    if (this.raw) {
      return super.pickEndpoint();
    }
    let currentEndpoint;
    for (let i = 0; i <= this._endpoints.length; i++) {
      if (this._endpoints[i] && this._endpoints[i].currentWeight >= this._gcd
        && (!currentEndpoint || currentEndpoint.currentWeight < this._endpoints[i].currentWeight)) {
        currentEndpoint = this._endpoints[i];
      }
    }
    if (!currentEndpoint) {
      this.restoreCurrentWeight();
      return this.pickEndpoint();
    }
    currentEndpoint.currentWeight -= this._gcd;
    return currentEndpoint.server;
  }
}


module.exports = function Turdus(endpoints) {
  const wrongEndpointsError = new Error('endpoints structure should be string[] or {server: string, weight: number}[]');
  if (!_.isArray(endpoints) || !endpoints.length) {
    throw wrongEndpointsError;
  }
  if (typeof endpoints[0] === 'string') {
    return new RawTurdus(endpoints);
  } else if (typeof endpoints[0] === 'object') {
    return new WeightedTurdus(endpoints);
  }
  throw wrongEndpointsError;
};


// async function main() {
//   //let a = new Turdus([ '127.0.0.1', '127.0.0.2', '127.0.0.3' ]);
//   //await a.commonHttpRequest();
//   //await a.commonHttpRequest();
//   //await a.commonHttpRequest();
//   //await a.commonHttpRequest();
//   //await a.commonHttpRequest();
//
//
//   let b = new WeightedTurdus([
//     { server: '127.0.0.1',
//       weight: 10,
//     },
//     { server: '127.0.0.2',
//       weight: 5,
//     },
//     { server: '127.0.0.3',
//       weight: 7,
//     },
//   ]);
//
//   console.log(b);
//   console.log(b._endpoints);
//   console.log(WeightedTurdus.calculateGCD([ 36, 24 ]));
//   console.log(WeightedTurdus.calculateGCD([ 40, 10, 90 ]));
//   b.request({ uri: '/hahahahaa',  method: 'GET' })
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//   b.request({ uri: '/hahahahah',  method: 'GET' });
//
//   const result = await realRequest({
//     method: 'GET',
//     uri: 'https://pigeon-staging.mokahr.com/',
//   })
//   console.log(result.body, result.statusCode);
// }
//
// main();
