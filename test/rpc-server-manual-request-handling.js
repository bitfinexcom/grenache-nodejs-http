/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const setupHooks = require('./before-after.js')

const PORT = 1337
let link, peer, peerSrvStr, serviceStr, stop
describe('RPC integration', () => {
  setupHooks((grapes) => {
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

    link.announce('rpc_manual', serviceStr.port, {}, (err, res) => {
      if (err) throw Error('error in announce, setup')
    })

    stop = () => {
      peer.stop()
      link.stop()
      serviceStr.stop()
    }
  })

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
    args: [ buf.toString('hex'), optsPdf ]
  }

  it('manual request handling works', (done) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, false)

      if (meta.isStream === false) {
        // console.log('no stream content, decide to parse')
        serviceStr.handleBufferedRequest(req, res, meta)
      }
    })

    serviceStr.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_manual')
      const [pdf, opts] = payload.args
      assert.deepStrictEqual(opts, optsPdf)

      assert.deepStrictEqual([pdf[0], pdf[1], pdf[2]].join(''), '255')

      assert.strictEqual(meta.isStream, false)
      handler.reply(null, 'ok')
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_manual', queryUploadPublicPdf, opts, (err, result) => {
      if (err) throw err
      assert.deepStrictEqual(result, 'ok')

      stop()
      done()
    })
  }).timeout(7000)
})
