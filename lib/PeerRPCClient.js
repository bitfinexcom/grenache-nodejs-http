'use strict'

const Base = require('grenache-nodejs-base')
const TransportRPCClient = require('./TransportRPCClient')
const duplexify = require('duplexify')
const { PassThrough } = require('stream')
const pump = require('pump')

class PeerRPCClient extends Base.PeerRPCClient {
  getTransportClass () {
    return TransportRPCClient
  }

  getRequestOpts (opts) {
    const res = {
      timeout: opts.timeout
    }

    if (opts.headers) {
      res.headers = opts.headers
    }

    return res
  }

  stream (key, opts) {
    const dup = duplexify()
    const incoming = new PassThrough()
    const outgoing = new PassThrough()

    dup.setReadable(outgoing)
    dup.setWritable(incoming)

    this.link.lookup(key, {}, (err, dests) => {
      if (err) {
        dup.destroy(err)
        return
      }

      const dest = this.dest(dests, key, this.getDestOpts(opts))
      const t = this.transport(dest, this.getTransportOpts(opts))

      const req = t.requestStream(key, this.getRequestOpts(opts))
      pump(incoming, req, outgoing)
    })

    return dup
  }
}

module.exports = PeerRPCClient
