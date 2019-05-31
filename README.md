# Turdus

Turdus is a client side HTTP [Round-robin](https://en.wikipedia.org/wiki/Round-robin) and [Weighted round-robin](https://en.wikipedia.org/wiki/Weighted_round_robin) load balancing library.

It provides following features:

* Client side Load balancing
* Fault tolerance
* Normalized Response on request failure.

## Principle

For simple Round-robin, it is basically array loop.

For weighted round robin algorithm:

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
const trudus = Turdus(['127.0.0.1', '127.0.0.2', '127.0.0.3']);

async function touchServer() {
  await turdus.request({
    method: 'GET',
    uri: '/cat-books',
  });
}

await touchServer();
await touchServer();
await touchServer();
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
const turdus = Turdus([
  { server: '127.0.0.1', weight: 5 },
  { server: '127.0.0.2', weight: 10 },
  { server: '127.0.0.3', weight: 4 },
]);

async function touchServer() {
  await turdus.request({
    method: 'GET',
    uri: '/cat-books',
  });
}

await touchServer();
await touchServer();
await touchServer();
// ...

// will touch known resources by their weight.
//
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// curl http://127.0.0.1/cat-books
// curl http://127.0.0.2/cat-books
// curl http://127.0.0.3/cat-books
// ...

```

## License

MIT
