# [Grenache](https://github.com/bitfinexcom/grenache) Node.JS HTTP implementation

<img src="logo.png" width="15%" />

Grenache is a micro-framework for connecting microservices. Its simple and optimized for performance.

Internally, Grenache uses Distributed Hash Tables (DHT, known from Bittorrent) for Peer to Peer connections. You can find more details how Grenche internally works at the [Main Project Homepage](https://github.com/bitfinexcom/grenache)

 - [Setup](#setup)
 - [Examples](#examples)
 - [API](#api)

## Setup

### Install
```
npm install --save grenache-nodejs-http
```

### Other Requirements

Install `Grenache Grape`: https://github.com/bitfinexcom/grenache-grape:

```bash
npm i -g grenache-grape
```

```
// Start 2 Grapes
grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'
```

### Examples

#### RPC Server / Client

This RPC Server example announces a service called `rpc_test`
on the overlay network. When a request from a client is received,
it replies with `world`. It receives the payload `hello` from the
client.

The client sends `hello` and receives `world` from the server.

Internally the DHT is asked for the IP of the server and then the
request is done as Peer-to-Peer request via websockets.

**Grape:**

```bash
grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'
```

**Server:**

```js
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {
  timeout: 300000
})
peer.init()

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
  console.log(payload) // hello
  handler.reply(null, 'world')
})
```

**Client:**

```js
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCClient(link, {})
peer.init()

peer.request('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
  if (err) {
    console.error(err)
    process.exit(-1)
  }
  console.log(data) // world
})
```

[Code Server](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_server.js)
[Code Client](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_client.js)

## API

### Class: PeerRPCServer

#### Event: 'stream'

Always emitted as son as a request arrives. Emits the raw `req` and `res` streams
of the request and some preparsed metadata. Used for streaming. If
`disableBuffered` is set to `false`, the server will attempt to buffer after
emitting the stream event.

```js
serviceStr.on('stream', (req, res, meta, handler) => {
  console.log(meta) // meta.isStream === true

  const [rid, key] = meta.infoHeaders

  req.pipe(process.stdout)

  handler.reply(rid, null, 'world') // convenience reply
})

```

[Example](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_server_stream.js).



#### Event: 'request'

Emitted when a request from a RPC client is received. In the lifecycle of a
request this happens after the server has parsed an buffered the whole data.
When the server runs with `disableBuffered: true`, the event must emitted manually,
if needed, or by calling the buffering request handlers manually.

  - `rid` unique request id
  - `key` name of the service
  - `payload` Payload sent by client
  - `handler` Handler object, used to reply to a client.

```js
service.on('request', (rid, key, payload, handler) => {
  handler.reply(null, 'world')
})
```

#### new PeerRPCServer(link, [options])

 - `link <Object>` Instance of a [Link Class](#new-linkoptions)
 - `options <Object>`
   - `disableBuffered <Boolean>` Disable automatic buffering of the incoming request data stream. Useful for streaming.
   - `timeout <Object>` Server-side socket timeout
   - `secure <Object>` TLS options
     - `key <Buffer>`
     - `cert <Buffer>`
     - `ca <Buffer>`
     - `requestCert <Boolean>`
     - `rejectUnauthorized <Boolean>`

Creates a new instance of a `PeerRPCServer`, which connects to the DHT
using the passed `link`.

#### peer.init()

Sets the peer active. Must get called before we get a transport
to set up a server.

#### peer.transport('server')

Must get called after the peer is active. Sets peer into server-
mode.

#### peer.listen(port)

Lets the `PeerRPCServer` listen on the desired `port`. The port is
stored in the DHT.

#### peer.port

Port of the server (set by `listen(port)`).

#### Example

This RPC Server example announces a service called `rpc_test`
on the overlay network. When a request from a client is received,
it replies with `world`. It receives the payload `hello` from the
client.

The client sends `hello` and receives `world` from the server.

Internally the DHT is asked for the IP of the server and then the
request is done as Peer-to-Peer request via websockets.

**Server:**

```js
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {})
peer.init()

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
  console.log(payload) // hello
  handler.reply(null, 'world')
})
```

**Client:**

```js
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCClient(link, {})
peer.init()

peer.request('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
  if (err) {
    console.error(err)
    process.exit(-1)
  }
  console.log(data) // world
})
```

[Server](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_server.js)
[Client](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_client.js)


### Class: PeerRPCClient

#### new PeerRPCClient(link, [options])

 - `link <Object>` Instance of a [Link Class](#new-linkoptions)
 - `options <Object>`
   - `maxActiveKeyDests <Number>`
   - `maxActiveDestTransports <Number>`
   - `secure <Object>` TLS options
     - `key <Buffer>`
     - `cert <Buffer>`
     - `ca <Buffer>`
     - `rejectUnauthorized <Boolean>`


Creates a new instance of a `PeerRPCClient`, which connects to the DHT
using the passed `link`.

A PeerRPCClient can communicate with multiple Servers and map work items over them.
With `maxActiveKeyDests` you can limit the maximum amount of destinations.
Additionally, you can limit the amount of transports with `maxActiveDestTransports`.

#### peer.init()

Sets the peer active. Must get called before we start to make requests.

#### peer.map(name, payload, [options], callback)
  - `name <String>` Name of the service to address
  - `payload <String>` Payload to send
  - `options <Object>` Options for the request
    - `timeout <Number>` timeout in ms
    - `limit <Number>` maximum requests per available worker
  - `callback <Function>`

Maps a number of requests over the amount of registered workers / PeerRPCServers.
[Example](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_client_map.js).


#### peer.request(name, payload, [options], callback)
  - `name <String>` Name of the service to address
  - `payload <String>` Payload to send
  - `options <Object>` Options for the request
    - `timeout <Number>` timeout in ms
    - `retry <Number>` attempts to make before giving up. default is 1
  - `callback <Function>`

Sends a single request to a RPC server/worker.
[Example](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_client.js).


#### peer.stream(name, opts)
  - `name <String>` Name of the service to address
  - `options <Object>` Options for the request
    - `timeout <Number>` timeout in ms
    - `headers <Object>` Headers to add to the request

Looks a service up and returns a req-object which is a stream.
Additional parameters (e.g. content-type), can be added via options.

The default metadata values for the request id and key are automatically
via header.

[Example](https://github.com/bitfinexcom/grenache-nodejs-http/tree/master/examples/rpc_client_stream.js).
