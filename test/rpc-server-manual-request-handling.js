'use strict'

const test = require('brittle')
const fs = require('fs')
const path = require('path')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const { grapeTestCase } = require('./before-after')

const PORT = 1337
let link, peer, peerSrvStr, serviceStr

const grapeTest = grapeTestCase(() => {
  link = new Link({
    grape: 'http://127.0.0.1:30001'
  })
  link.start()

  peer = new PeerRPCClient(link, {})
  peer.init()

  peerSrvStr = new PeerRPCServer(link, {
    timeout: 300000,
    disableBuffered: true
  })

  peerSrvStr.init()
  serviceStr = peerSrvStr.transport('stream')
  serviceStr.listen(PORT)

  link.announce('rpc_manual', serviceStr.port, {}, (err) => {
    if (err) throw Error('error in announce, setup')
  })

  return () => {
    peer.stop()
    link.stop()
    serviceStr.stop()
  }
})

test('RPC integration', (t) => {
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

  t.test('manual request handling works', { timeout: 7000 }, grapeTest(async (t) => {
    serviceStr.on('stream', (req, res, meta) => {
      t.is(meta.isStream, false)

      if (meta.isStream === false) {
        // console.log('no stream content, decide to parse')
        serviceStr.handleBufferedRequest(req, res, meta)
      }
    })

    serviceStr.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_manual')
      const [pdf, opts] = payload.args
      t.alike(opts, optsPdf)

      t.alike([pdf[0], pdf[1], pdf[2]].join(''), '255')

      t.is(meta.isStream, false)
      handler.reply(null, 'ok')
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_manual', queryUploadPublicPdf, opts, (err, result) => {
        if (err) throw err
        t.alike(result, 'ok')
        resolve()
      })
    })
  }))
})
