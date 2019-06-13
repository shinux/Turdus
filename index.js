const _ = require('lodash');
const bluebird = require('bluebird');
const realRequest = bluebird.promisify(require('request'));


const simpleEndpointsChecker = (endpoints) => {
  const wrongEndpointsError = new Error('endpoints structure should be { [key:string]: string[]} or { [key:string]: {server: string, weight: number}[] }');
  Object.keys(endpoints).forEach((app) => {
    if (!_.isArray(endpoints[app]) || !endpoints[app].length) {
      throw wrongEndpointsError;
    }
  });
};

/**
 * RawTurdus is base class which accept String[] type endpoints
 * and request in simple round robin
 *
 * Public interface:
 *
 * fn: request()         - do real http request in specific domain by module: request.
 * fn: fakePositiveRes() - simulate positive response by passing response mapping.
 */
class RawTurdus {
  constructor(endpoints) {
    this._endpoints = endpoints ? _.cloneDeep(endpoints) : {};
    this._appNames = Object.keys(endpoints);
    this._indices = this._appNames.reduce((obj, appName) => { obj[appName] = 0; return obj; }, {});
    this._pathToResMapping = {};
  }

  /**
   * @Private
   *
   * set specific app's index to zero.
   *
   * @param {String} appName - app name.
   */
  _resetIndex(appName) {
    this._indices[appName] = 0;
  }

  /**
   * fault tolerance.
   *
   * preset response to avoid error.
   *
   * @param {Object} _responseMapping - { path: responseBody }: { [key:string]: string | object }
   *
   */
  fakePositiveRes(appName, _responseMapping) {
    this._pathToResMapping[appName] = _responseMapping;
  }

  /**
   * @Private
   *
   * pick domain from endpoint list then update index.
   *
   * @return {String} currentEndpoint - an ip/domain
   */
  pickEndpoint(appName) {
    if (!_.has(this._indices, appName) || !this._endpoints[appName]) {
      throw new Error('invalid endpoint index or no endpoints for current app name.');
    }
    if (this._indices[appName] >= this._endpoints[appName].length) {
      this._resetIndex(appName);
    }
    const currentEndpoint = this._endpoints[appName][this._indices[appName]];
    this._indices[appName]++;
    return currentEndpoint;
  }

  /**
   * execute http request with pointed domain from prepared endpoint list
   *
   * @param {String} appName - app name.
   * @param {Object} options - request options: method, uri, body, json...
   *                           [https://github.com/request/request]
   * @return {Promise} resolves to request response object.
   */
  async request(appName, options) {
    if (!appName || !this._appNames.includes(appName)) {
      throw new Error('No such app, or specific app has not been initialized.');
    }
    const originPath = options.uri;
    try {
      const server = this.pickEndpoint(appName);
      options.uri = 'http://' + server + options.uri;
      const result = await realRequest(options);
      if (result.statusCode > 200) {
        throw new Error(result.body);
      }
      return result;
    } catch (err) {
      if (this._pathToResMapping[appName] && this._pathToResMapping[appName][originPath]) {
        return { statusCode: 200, body: this._pathToResMapping[appName][originPath] };
      }
      throw new Error(`Error occured during request: ${err.message || err.body}`);
    }
  }
}

// function aims to calculate greatest common divisor of two values.
const gcd = (a, b) => !b ? a : gcd(b, a % b);


/**
 * @Deprecated
 *
 * Simple WeightedTurdus is subclass of RawTurdus
 * which accpet { server: string, weight: number }[] type endpoints
 * and request in weighted round robin
 *
 * Public interface:
 *
 * fn: request()      - do real http request in specific domain by module: request.
 */
class SimpleWeightedTurdus extends RawTurdus {
  constructor(endpoints) {
    super(endpoints);
    if (this._endpoints.lenght < 0
      || this._endpoints.every((endpoint) => !endpoint.weight || endpoint.weight === 0)) {
      this._endpoints = this._endpoints.map((endpoint) => endpoint.server);
      this.raw = true;
    } else {
      this.restoreCurrentWeight();
      this._gcd = SimpleWeightedTurdus.calculateGCD(this._endpoints.map((server) => server.weight));
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

/**
 * nginx-like smooth weighted round-robin balancing.
 *
 * Algorithm is as follows: on each peer selection we increase current_weight
 * of each eligible peer by its weight, select peer with greatest current_weight
 * and reduce its current_weight by total number of weight points distributed
 * among peers.
 *
 * see also: https://github.com/phusion/nginx/commit/27e94984486058d73157038f7950a0a36ecc6e35
 *
 * fn:  fullyUpdateEndpoints() - fully update endpoints.
 *
 */
class SmoothWeightedTurdus extends RawTurdus {
  constructor(endpoints) {
    super(endpoints);
    this._appStatus = {};
    this.upsertEndpoints(this._endpoints);
  }

  /**
   * update exist endpoints
   * merely cover the old endpoints and add new but wont's do remove operations.
   *
   * @param {Object} AppToEndpoints - { [key:string]: string[]} or { [key:string]: {server: string, weight: number}[] }
   */
  upsertEndpoints(_appToEndpoints) {
    simpleEndpointsChecker(_appToEndpoints);
    const appToEndpoints = _.cloneDeep(_appToEndpoints);
    Object.keys(appToEndpoints).forEach((appName) => {
      if (!this._appStatus[appName]) {
        this._appStatus[appName] = {};
      }
      // in case new application' endpoints created or updated.
      // here we do a re-assign.
      this._endpoints[appName] = appToEndpoints[appName];
      if (appToEndpoints[appName].every((endpoint) => !endpoint.weight || endpoint.weight === 0)) {
        this._endpoints[appName] = appToEndpoints[appName].map((endpoint) => typeof endpoint === 'object' ? endpoint.server : endpoint);
        this._appStatus[appName].isRaw = true;
        this._resetIndex(appName);
      } else {
        this.restoreCurrentWeight(appName);
        this._appStatus[appName].weightSum = appToEndpoints[appName].map((server) => server.weight).reduce((a, b) => a + b, 0);
      }
    });
  }

  /**
   * @Private
   *
   * set currentWeight.
   */
  restoreCurrentWeight(appName) {
    this._endpoints[appName] = this._endpoints[appName].map((server) => {
      server.currentWeight = 0;
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
  pickEndpoint(appName) {
    if (this._appStatus[appName].isRaw) {
      return super.pickEndpoint(appName);
    }
    let currentEndpoint;
    for (let i = 0; i < this._endpoints[appName].length; i++) {
      this._endpoints[appName][i].currentWeight += this._endpoints[appName][i].weight;
      if (!currentEndpoint || currentEndpoint.currentWeight < this._endpoints[appName][i].currentWeight) {
        currentEndpoint = this._endpoints[appName][i];
      }
    }
    currentEndpoint.currentWeight -= this._appStatus[appName].weightSum;
    return currentEndpoint.server;
  }

}

/**
 * [ x, y, z ]
 * [ { server: x, weight: 5 }, { server: y, weight: 6 }, { server: z, weight: 2 } ]
 *
 * accepted object. { app1: [], app2: [] }
 *
 */
module.exports = function Turdus(AppToEndpoints) {
  simpleEndpointsChecker(AppToEndpoints);
  return new SmoothWeightedTurdus(AppToEndpoints);
};
