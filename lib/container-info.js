const getContainerInfo = require('container-info')

/**
 * Function that uses `container-info`
 * package to extract container information
 * and apply additional naming rules
 *
 * Injectable getInfo for testing purposes
 *
 * https://github.com/elastic/apm/blob/master/specs/agents/metadata.md#containerkubernetes-metadata
 */
module.exports = (getInfo = getContainerInfo) => {
  const info = getInfo.sync()
  if (!info) { return info }

  if (info.podId) {
    info.podId = info.podId.replace(/_/g, '-')
  }
  return info
}
