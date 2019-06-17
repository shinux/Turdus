# Turdus [![Build Status][circleci-image]][circleci-url] [![NPM Version][npm-image]][npm-url] ![node](https://img.shields.io/node/v/turdus.svg?style=flat-square)

[circleci-image]: https://img.shields.io/circleci/build/github/shinux/Turdus.svg?style=popout-square
[circleci-url]: https://circleci.com/gh/shinux/workflows/Turdus

[npm-image]: https://img.shields.io/npm/v/turdus.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/turdus

Turdus is a client side HTTP [Round-robin](https://en.wikipedia.org/wiki/Round-robin) and [Weighted round-robin](https://en.wikipedia.org/wiki/Weighted_round_robin) load balancing library.

It provides following features:

* Client side Load balancing
* Fault tolerance
* Normalized Response on request failure.
* Mutiple apps supported.

## Principle

For simple Round-robin, it is basically array loop.

For weighted round robin algorithm, on each peer selection we increase current_weight
of each eligible peer by its weight, select peer with greatest current_weight
and reduce its current_weight by total number of weight points distributed
among peers.

see also: [nginx implementation](https://github.com/phusion/nginx/commit/27e94984486058d73157038f7950a0a36ecc6e35)


**[Deprecated]** For weighted round robin algorithm (gcd version):

1. calculate [GCD](https://en.wikipedia.org/wiki/Greatest_common_divisor) of all endpoints' weight
2. choose the max weighted endpoint then minus GCD
3. if largest weight belongs to more than one endpoint, choose the small index one.
4. set to original weight until no weight bigger than zero.
5. repeat the procedures above.

## Usage

install turdus by npm.

```
npm install turdus
```

Provide or fetch your callee apps' IP/domain from written configs

or subscribe event by eureka client and fetchRegistry from [Eureka](https://github.com/Netflix/eureka)

1. simple polling each server.

```javascript
const Turdus = require('turdus');
// initialize multiple app
const trudus = Turdus({ 
  bird: ['127.0.0.1', '127.0.0.2', '127.0.0.3'],
  kitten: ['192.168.0.1', '192.168.0.2', '192.168.0.3'],
});

async function touchServer() {
  await turdus.request('bird', {
    method: 'GET',
    uri: '/cat-books',
  });
}

touchServer();
touchServer();
touchServer();
// ...

// will touch known resources one by one.
//
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// ...

```

2. weighted polling each servers;

```javascript
const Turdus = require('turdus');
const turdus = Turdus({ bird: [
  { server: '127.0.0.1', weight: 5 },
  { server: '127.0.0.2', weight: 10 },
  { server: '127.0.0.3', weight: 4 },
]});

async function touchServer() {
  await turdus.request('bird', {
    method: 'GET',
    uri: '/cat-books',
  });
}

touchServer();
touchServer();
touchServer();
// ...

// will touch known resources by their weight.
//
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// ...

```

3. fault tolerance and nomalize error response.


```javascript
const turdus = Turdus({ bird: [ '127.0.0.1', '127.0.0.2' ] });
turdus.fakePositiveRes('bird', {
  '/cat-birds': 'though some error appeared',
  '/cat-books': [ 'The Fountainhead', 'Poor Charlie's Almanack:The Wit and Wisdom of Charles T. Munger', 'The Little Prince' ],
});

turdus.request('bird', {
  uri: '/cat-birds',
  method: 'POST',
  body: { yy: 6 },
  json: true,
})
.then((result) => {
  // though enpoints is not touchable
  // we can get positive response due to preset method.
  // result.statusCode: 200
  // result.body: 'though some error appeared',
});

```

4. update exist applications' endpoints or add new applications.

```javascript
const endpoints = {
  kitten: [
    { server: '127.0.0.1', weight: 0 },
    { server: '127.0.0.2', weight: 0 },
  ],
  doggy: [
    { server: '192.168.0.1', weight: 0 },
    { server: '192.168.0.2', weight: 0 },
  ],
};
const turdus = Turdus(endpoints);
turdus.upsertEndpoints({
  doggy: [
    { server: '192.168.0.1', weight: 3 },
    { server: '192.168.0.2', weight: 3 },
    { server: '192.168.0.3', weight: 1 },
    { server: '192.168.0.4', weight: 1 },
  ],
});

// the doggy application's endpoints will be changed.
// also it's balance type got changed from raw to weighted.
```

NOTE: this function will reset related applications' current polling order to original status.

## License

MIT
