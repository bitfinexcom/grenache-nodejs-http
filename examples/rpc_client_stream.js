'use strict'

const Grenache = require('./../')
const Link = require('grenache-nodejs-link')
const Peer = Grenache.PeerRPCClient
const { PassThrough } = require('stream')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new Peer(link, {})
peer.init()

const req = peer.stream('rpc_stream', {
  headers: {
    _a: 'uploadNewPublicStream',
    _ar: { foo: 'bar' },
    'content-type': 'application/pdf'
  },
  timeout: 10000
})

const writable = new PassThrough()
writable.write('hello')
writable.pipe(req)
req.on('data', (d) => {
  console.log('response', d.toString())
})
