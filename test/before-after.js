/* eslint-env mocha */

'use strict'

const { startGrapes, stopGrapes } = require('./helper')

let grapes
function setupHooks (cb) {
  beforeEach(async function () {
    this.timeout(20000)

    grapes = await startGrapes()
    cb()

    await new Promise((resolve) => {
      grapes[0].once('announce', () => resolve())
    })
  })

  afterEach(async function () {
    this.timeout(5000)
    await stopGrapes(grapes)
  })

  return grapes
}

module.exports = setupHooks
