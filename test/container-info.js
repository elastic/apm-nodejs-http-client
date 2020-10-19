const test = require('tape')
const getContainerInfo = require('container-info')
const containerInfo = require('../lib/container-info')

const createMockForFixtureString = (source) => {
  const mock = {
    sync: () => {
      const string = source
      return getContainerInfo.parse(string)
    }
  }
  return mock
}

test('./lib/container-info ', function (t) {
  const fixtures = [
    {
      source: '12:freezer:/kubepods.slice/kubepods-pod22949dce_fd8b_11ea_8ede_98f2b32c645c.slice/docker-b15a5bdedd2e7645c3be271364324321b908314e4c77857bbfd32a041148c07f.scope',
      expectedPodId: '22949dce-fd8b-11ea-8ede-98f2b32c645c'
    },
    {
      source: '11:devices:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '10:perf_event:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '9:memory:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '8:freezer:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '7:hugetlb:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '6:cpuset:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '5:blkio:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '4:cpu,cpuacct:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '3:net_cls,net_prio:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '2:pids:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '1:name=systemd:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    }
  ]
  for (const [, fixture] of fixtures.entries()) {
    const mock = createMockForFixtureString(fixture.source)
    const info = containerInfo(mock)
    // console.log(info)
    t.equals(info.podId, fixture.expectedPodId)
  }

  t.end()
})
