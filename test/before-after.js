'use strict'

const { startGrapes, stopGrapes } = require('./helper')
const Link = require('grenache-nodejs-link')
const { PeerRPCClient, PeerRPCServer } = require('../index')
const fs = require('fs')
const path = require('path')

const SERVICE_PORT = 1337

const rpcTestCase = ({ transport, isSecure, disableBuffered }) => (testBlock) => async (t) => {
  let grapes, peer, link, service
  try {
    grapes = await startGrapes()

    const announceTask = new Promise((resolve) => {
      grapes[0].once('announce', () => resolve())
    })
    link = new Link({
      grape: 'http://127.0.0.1:30001'
    })
    link.start()

    const peerOpts = {}
    if (isSecure) {
      peerOpts.secure = {
        key: fs.readFileSync(path.join(__dirname, './certs/client1-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, './certs/client1-crt.pem')),
        ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
        rejectUnauthorized: false // take care, can be dangerous in production!
      }
    }
    peer = new PeerRPCClient(link, peerOpts)
    peer.init()

    const peerSrvOpts = {
      timeout: 300000
    }
    if (isSecure) {
      peerSrvOpts.secure = {
        key: fs.readFileSync(path.join(__dirname, './certs/server-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, './certs/server-crt.pem')),
        ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
        requestCert: true,
        rejectUnauthorized: false // take care, can be dangerous in production!
      }
    }
    if (disableBuffered) { peerSrvOpts.disableBuffered = true }
    const peerSrv = new PeerRPCServer(link, peerSrvOpts)

    peerSrv.init()
    service = peerSrv.transport(transport)
    service.listen(SERVICE_PORT)

    link.announce('rpc_test', service.port, {}, (err) => {
      if (err) throw Error('error in announce, setup')
    })
    await announceTask

    await testBlock({ t, service, peer })
  } finally {
    if (peer) peer.stop()
    if (link) link.stop()
    if (service) service.stop()
    if (grapes) await stopGrapes(grapes)
  }
}

module.exports = { rpcTestCase }
