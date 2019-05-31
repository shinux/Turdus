const _ = require('lodash');
const bluebird = require('bluebird');
const realRequest = bluebird.promisify(require('request'));


/**
 * RawTurdus is base class which accpet String[] type endpoints
 * and request in simple round robin
 *
 * Public interface:
 *
 * fn: request()      - do real http request in specific domain by module: request.
 */
class RawTurdus {
  constructor(endpoints) {
    this._endpoints = endpoints || [];
    this._index = 0;
  }

  /**
   * @Private
   *
   * pick domain from endpoint list then update index.
   *
   * @return {String} currentEndpoint - an ip/domain
   */
  pickEndpoint() {
    if (this._index >= this._endpoints.length) {
      this._index = 0;
    }
    const currentEndpoint = this._endpoints[this._index];
    this._index++;
    return currentEndpoint;
  }

  /**
   * execute http request with pointed domain from prepared endpoint list
   *
   * @param {Object} options - request options: method, uri, body, json...
   *                           [https://github.com/request/request]
   * @return {Promise} resolves to request response object.
   */
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

// function aims to calculate greatest common divisor of two values.
const gcd = (a, b) => !b ? a : gcd(b, a % b);


/**
 * WeightedTurdus is subclass of RawTurdus
 * which accpet { server: string, weight: number }[] type endpoints
 * and request in weighted round robin
 *
 * Public interface:
 *
 * fn: request()      - do real http request in specific domain by module: request.
 */
class WeightedTurdus extends RawTurdus {
  constructor(endpoints) {
    super(endpoints);
    if (this._endpoints.lenght < 0
      || this._endpoints.every((endpoint) => !endpoint.weight || endpoint.weight === 0)) {
      this._endpoints = this._endpoints.map((endpoint) => endpoint.server);
      this.raw = true;
    } else {
      this.restoreCurrentWeight();
      this._gcd = WeightedTurdus.calculateGCD(this._endpoints.map((server) => server.weight));
    }
  }

  /**
   * calculate greatest common diviosr of more than two values.
   *
   * @param {Array} numbers - array of numbers.
   * @return {Number} gcd number of numbers.
   */
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
   * revert all enpoints' weight to their origin weight.
   * prepare for next round calling.
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
