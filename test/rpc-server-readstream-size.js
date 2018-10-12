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

  const pdfFile = path.join(__dirname, './example-amazon-dynamo-sosp2007.pdf')

  it('manual request handling works', (done) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      assert.strictEqual(meta.isStream, true)
      assert.strictEqual(req.headers['content-type'], 'application/pdf')

      const rid = meta.infoHeaders[0]
      const writer = fs.createWriteStream('test.pdf')
      req.pipe(writer)

      writer.on('close', () => {
        const origStat = fs.statSync(pdfFile)
        const res = fs.statSync('test.pdf')
        assert.strictEqual(res.size, origStat.size)

        handler.reply(rid, null, 'ok')
      })
    })

    const optsPdf = {
      key: 'example-amazon-dynamo-sosp2007-4.pdf',
      acl: 'public-read',
      bucket: 'BUCKET',
      contentType: 'application/pdf'
    }
    const req = peer.stream('rpc_manual', {
      headers: {
        _a: 'uploadNewPublicStream',
        _ar: optsPdf,
        'content-type': 'application/pdf'
      },
      timeout: 10000
    })

    req.on('data', (data) => {
      const [,, msg] = JSON.parse(data.toString())
      assert.strictEqual(msg, 'ok')
      stop()
      done()
    })

    const data = fs.createReadStream(pdfFile)

    data.pipe(req)
  }).timeout(7000)
})
