'use strict'

const Base = require('grenache-nodejs-base')
const TransportRPCClient = require('./TransportRPCClient')

class PeerRPCClient extends Base.PeerRPCClient {
  getTransportClass () {
    return TransportRPCClient
  }

  getRequestOpts (opts) {
    const res = {
      timeout: opts.timeout,
      compress: opts.compress
    }

    if (opts.headers) {
      res.headers = opts.headers
    }

    return res
  }
}

module.exports = PeerRPCClient
