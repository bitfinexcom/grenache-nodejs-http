/* eslint-env mocha */

'use strict'

const assert = require('assert')
const spawn = require('child_process').spawn
const path = require('path')
const fs = require('fs')

const parallel = require('async/parallel')
const Base = require('grenache-nodejs-base')
const Peer = require('./../').PeerRPCClient

const secure = {
  key: fs.readFileSync(path.join(__dirname, 'fixtures', 'client1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'client1-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, 'fixtures', 'ca-crt.pem')),
  rejectUnauthorized: false // take care, can be dangerous in production!
}

const VALID_FINGERPRINT = '22:48:11:0C:56:E7:49:2B:E9:20:2D:CE:D6:B0:7D:64:F2:32:C8:4B'
const INVALID_FINGERPRINT = '22:48:11:0C:56:E7:49:2B:E9:20:2D:CE:D6:B0:7D:64:F2:32:C8:23'

let rpc, grape
describe('RPC tls integration, valid fingerprint', () => {
  before(function (done) {
    this.timeout(6000)
    grape = spawn(path.join(__dirname, 'boot-grape.sh'), { detached: true })
    setTimeout(() => {
      const f = path.join(__dirname, 'fixtures', 'mock-rpc-tls-server.js')
      rpc = spawn('node', [ f, VALID_FINGERPRINT ])

      rpc.stdout.on('data', (d) => {
        console.log('mock-rpc-tls-server.js: ', d.toString())
      })

      rpc.stderr.on('data', (d) => {
        console.log('mock-rpc-tls-server.js: ', d.toString())
      })

      done()
    }, 5000)
  })

  after(function (done) {
    this.timeout(5000)
    rpc.on('close', () => {
      done()
    })

    grape.on('close', () => {
      rpc.kill()
    })

    process.kill(-grape.pid)
  })

  it('messages with the rpc worker', (done) => {
    const link = new Base.Link({
      grape: 'ws://127.0.0.1:30001'
    })
    link.start()

    const peer = new Peer(link, { secure: secure })
    peer.init()

    const reqs = 5
    const tasks = []

    function createTask () {
      return function task (cb) {
        peer.map('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
          cb(err, data)
        })
      }
    }

    for (let i = 0; i < reqs; i++) {
      tasks.push(createTask())
    }

    setTimeout(() => {
      parallel(tasks, (err, data) => {
        if (err) throw err
        assert.equal(data[0][0], 'fingerprint validated')
        assert.equal(data.length, 5)
        done()
      })
    }, 5000)
  }).timeout(20000)
})

describe('RPC tls integration, invalid fingerprint', () => {
  before(function (done) {
    this.timeout(6000)
    grape = spawn(path.join(__dirname, 'boot-grape.sh'), { detached: true })
    setTimeout(() => {
      const f = path.join(__dirname, 'fixtures', 'mock-rpc-tls-server.js')
      rpc = spawn('node', [ f, INVALID_FINGERPRINT ])

      rpc.stdout.on('data', (d) => {
        console.log('mock-rpc-tls-server.js: ', d.toString())
      })

      rpc.stderr.on('data', (d) => {
        console.log('mock-rpc-tls-server.js: ', d.toString())
      })

      done()
    }, 5000)
  })

  after(function (done) {
    this.timeout(5000)
    rpc.on('close', () => {
      done()
    })

    grape.on('close', () => {
      rpc.kill()
    })

    process.kill(-grape.pid)
  })

  it('messages with the rpc worker', (done) => {
    const link = new Base.Link({
      grape: 'ws://127.0.0.1:30001'
    })
    link.start()

    const peer = new Peer(link, { secure: secure })
    peer.init()

    const reqs = 5
    const tasks = []

    function createTask () {
      return function task (cb) {
        peer.map('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
          cb(err, data)
        })
      }
    }

    for (let i = 0; i < reqs; i++) {
      tasks.push(createTask())
    }

    setTimeout(() => {
      parallel(tasks, (err, data) => {
        if (err) throw err
        assert.equal(data[0][0], 'fingerprint did not match! :(')
        assert.equal(data.length, 5)
        done()
      })
    }, 5000)
  }).timeout(20000)
})
