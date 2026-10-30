'use strict'

const test = require('brittle')
const { PassThrough } = require('stream')
const fs = require('fs')
const path = require('path')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const { grapeTestCase } = require('./before-after')

const PORT = 1337
let link, peer, peerSrvBuf, serviceBuf

const grapeTest = grapeTestCase(() => {
  link = new Link({
    grape: 'http://127.0.0.1:30001'
  })
  link.start()

  peer = new PeerRPCClient(link, {
    secure: {
      key: fs.readFileSync(path.join(__dirname, './certs/client1-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, './certs/client1-crt.pem')),
      ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
      rejectUnauthorized: false // take care, can be dangerous in production!
    }
  })
  peer.init()

  peerSrvBuf = new PeerRPCServer(link, {
    secure: {
      key: fs.readFileSync(path.join(__dirname, './certs/server-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, './certs/server-crt.pem')),
      ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
      requestCert: true,
      rejectUnauthorized: false // take care, can be dangerous in production!
    },
    timeout: 300000
  })

  peerSrvBuf.init()
  serviceBuf = peerSrvBuf.transport('buffered')
  serviceBuf.listen(PORT)

  link.announce('rpc_buf', serviceBuf.port, {}, (err) => {
    if (err) throw Error('error in announce, setup')
  })

  return () => {
    peer.stop()
    link.stop()
    serviceBuf.stop()
  }
})

test('RPC integration', async (t) => {
  await t.test('buffered parsing works, objects', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.alike(payload, { hello: 'world' })

      t.is(meta.isStream, false)

      handler.reply(null, { hello: 'helloworld' })
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_buf', { hello: 'world' }, opts, (err, result) => {
        if (err) throw err
        t.alike(result, { hello: 'helloworld' })
        resolve()
      })
    })
  }))

  await t.test('buffered parsing works, strings', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.is(payload, 'hello')

      t.is(meta.isStream, false)

      handler.reply(null, 'world')
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_buf', 'hello', opts, (err, result) => {
        if (err) throw err
        t.is(result, 'world')
        resolve()
      })
    })
  }))

  await t.test('buffered parsing works, compressed strings', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.is(payload, 'hello')

      t.is(meta.isStream, false)
      t.is(meta.compress, true)

      handler.reply(null, 'world')
    })

    const opts = { timeout: 100000, compress: true }
    await new Promise(resolve => {
      peer.request('rpc_buf', 'hello', opts, (err, result) => {
        if (err) throw err
        t.is(result, 'world')
        resolve()
      })
    })
  }))

  await t.test('buffered parsing works, strings from streaming client', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.is(payload, 'hello')
      t.is(meta.isStream, true)
      handler.reply(null, 'world')
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000
    })

    const p = new Promise(resolve => {
      req
        .on('data', (data) => {
          const d = JSON.parse(data.toString())
          // ["65c5737f-bbce-40f9-b48a-af8bd8869d66",null,"world"]
          t.is(d[1], null)
          t.is(d[2], 'world')
          resolve()
        })
        .on('end', () => {})
        .on('error', (e) => { console.error(e) })
    })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", "hello"]')
    writable.end()
    writable.pipe(req)

    await p
  }))

  await t.test('buffered parsing works, objects from streaming client', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.alike(payload, { hello: 'world' })
      t.is(meta.isStream, true)
      handler.reply(null, { hello: 'helloworld' })
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000
    })

    const p = new Promise(resolve => {
      req
        .on('data', (data) => {
          const d = JSON.parse(data.toString())
          t.is(d[1], null)
          t.alike(d[2], { hello: 'helloworld' })
          resolve()
        })
        .on('end', () => {})
        .on('error', (e) => { console.error(e) })
    })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", { "hello": "world" }]')
    writable.end()
    writable.pipe(req)

    await p
  }))

  await t.test('buffered parsing works, extra headers', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.alike(payload, { hello: 'world' })
      t.is(meta.action, 'uploadPublic')
      t.alike(meta.args, { foo: 'bar' })
      t.is(meta.isStream, true)
      handler.reply(null, { hello: 'helloworld' })
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000,
      headers: { _a: 'uploadPublic', _ar: { foo: 'bar' } }
    })

    const p = new Promise(resolve => {
      req
        .on('data', (data) => {
          const d = JSON.parse(data.toString())
          t.is(d[1], null)
          t.alike(d[2], { hello: 'helloworld' })
          resolve()
        })
        .on('end', () => {})
        .on('error', (e) => { console.error(e) })
    })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", { "hello": "world" }]')
    writable.end()
    writable.pipe(req)

    await p
  }))

  await t.test('buf/buf: serialized files work', { timeout: 7000 }, grapeTest(async (t) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_buf')
      t.is(payload.action, 'uploadPublic')
      t.is(payload.args[1].key, 'example-amazon-dynamo-sosp2007-4.pdf')
      t.is(typeof payload.args[0], 'string')
      t.is(meta.isStream, false)
      handler.reply(null, 'ok')
    })

    const opts = { timeout: 100000 }
    const buf = fs.readFileSync(
      path.join(__dirname, './example-amazon-dynamo-sosp2007.pdf')
    )

    const optsPdf = {
      key: 'example-amazon-dynamo-sosp2007-4.pdf',
      acl: 'public-read',
      bucket: 'bfx-dev-robert',
      contentType: 'application/pdf'
    }

    const queryUploadPublicPdf = {
      action: 'uploadPublic',
      args: [buf.toString('hex'), optsPdf]
    }
    await new Promise(resolve => {
      peer.request('rpc_buf', queryUploadPublicPdf, opts, (err, result) => {
        if (err) throw err
        t.alike(result, 'ok')
        resolve()
      })
    })
  }))
})
