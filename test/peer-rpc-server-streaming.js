/* eslint-env mocha */

const assert = require('assert')
const { PassThrough } = require('stream')
const { PeerRPCClient, PeerRPCServer, PeerRPCStreamClient } = require('../')
const Link = require('grenache-nodejs-link')
const setupHooks = require('./before-after.js')

const PORT = 1337
let link, peer, peerSrvStr, serviceStr, pst, stop
describe('RPC integration', () => {
  setupHooks((grapes) => {
    link = new Link({
      grape: 'http://127.0.0.1:30001'
    })
    link.start()

    peer = new PeerRPCClient(link, {})
    peer.init()

    pst = new PeerRPCStreamClient(link, {})
    pst.init()

    peerSrvStr = new PeerRPCServer(link, {
      timeout: 300000,
      disableBuffered: true
    })

    peerSrvStr.init()
    serviceStr = peerSrvStr.transport('stream')
    serviceStr.listen(PORT)

    link.announce('rpc_stream', serviceStr.port, {}, (err, res) => {
      if (err) throw Error('error in announce, setup')
    })

    stop = () => {
      peer.stop()
      pst.stop()
      link.stop()
      serviceStr.stop()
    }
  })

  it('streaming works, objects, buffered client, reply handler', (done) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        assert.deepStrictEqual(args, { hello: 'world' })
        assert.ok(typeof rid === 'string')
        assert.strictEqual(key, 'rpc_stream')

        handler.reply(rid, null, { hello: 'helloworld' })
      })
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_stream', { hello: 'world' }, opts, (err, result) => {
      if (err) throw err
      assert.deepStrictEqual(result, { hello: 'helloworld' })

      stop()
      done()
    })
  }).timeout(7000)

  it('streaming works, string, buffered client, reply handler', (done) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        assert.strictEqual(args, 'hello')
        assert.ok(typeof rid === 'string')
        assert.strictEqual(key, 'rpc_stream')

        handler.reply(rid, null, 'world')
      })
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_stream', 'hello', opts, (err, result) => {
      if (err) throw err
      assert.strictEqual(result, 'world')

      stop()
      done()
    })
  }).timeout(7000)

  it('streaming works, string, buffered client, stream sent back', (done) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        assert.strictEqual(args, 'hello')
        assert.ok(typeof rid === 'string')
        assert.strictEqual(key, 'rpc_stream')

        const writable = new PassThrough()
        const payload = JSON.stringify([rid, null, 'world2'])
        writable.pipe(res)
        writable.write(payload)
        writable.end()
      })
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_stream', 'hello', opts, (err, result) => {
      if (err) throw err
      assert.strictEqual(result, 'world2')

      stop()
      done()
    })
  }).timeout(7000)

  it('streaming works, buffer, stream client, stream on server', (done) => {
    const reqPayload = Buffer.from('megalargefile')
    const resPayload = Buffer.from('superlargefile')

    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, true)

      req.on('data', (d) => {
        const [rid, key] = meta.infoHeaders

        assert.ok(d.equals(reqPayload), 'received Buffer equals payload on server')

        assert.ok(typeof rid === 'string')
        assert.strictEqual(key, 'rpc_stream')

        const writable = new PassThrough()
        writable.pipe(res)
        writable.write(resPayload)
        writable.end()
      })
    })

    const req = pst.stream('rpc_stream', {
      timeout: 10000
    })

    req
      .on('data', (data) => {
        assert.ok(data.equals(resPayload), 'received Buffer equals payload on client')

        stop()
        done()
      })
      .on('end', () => {})
      .on('error', (e) => { console.error(e) })

    const writable = new PassThrough()
    writable.write(reqPayload)
    writable.pipe(req)
  }).timeout(7000)

  it('streaming works, buffer, stream client, stream on server, additional headers', (done) => {
    const reqPayload = Buffer.from('megalargefile')
    const resPayload = Buffer.from('superlargefile')

    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, true)

      req.on('data', (d) => {
        const [rid, key] = meta.infoHeaders

        assert.ok(d.equals(reqPayload), 'received Buffer equals payload on server')

        assert.ok(typeof rid === 'string')
        assert.strictEqual(key, 'rpc_stream')

        assert.strictEqual(meta.action, 'uploadPublic')
        assert.strictEqual(meta.args.foo, 'bar')

        const writable = new PassThrough()
        writable.pipe(res)
        writable.write(resPayload)
        writable.end()
      })
    })

    const req = pst.stream('rpc_stream', {
      timeout: 10000,
      headers: {
        _a: 'uploadPublic',
        _ar: { foo: 'bar' }
      }
    })

    req
      .on('data', (data) => {
        assert.ok(data.equals(resPayload), 'received Buffer equals payload on client')

        stop()
        done()
      })
      .on('end', () => {})
      .on('error', (e) => { console.error(e) })

    const writable = new PassThrough()
    writable.write(reqPayload)
    writable.pipe(req)
  }).timeout(7000)
})
