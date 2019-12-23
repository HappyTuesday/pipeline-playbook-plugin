import request from '../utils/request';

const apiRoot = "/playbook-pipeline-manage";

export async function getBranches() {
  return request(apiRoot + '/getBranches', {
    method: 'POST'
  });
}

export async function getDeployTable(targetBranch) {
  return request(apiRoot + '/getDeployTable', {
    method: 'POST',
    data: {
      targetBranch
    }
  });
}

export async function saveDraft(targetBranch, draft) {
  return request(apiRoot + '/saveDraft', {
    method: 'POST',
    data: {
      draft,
      targetBranch
    },
  });
}

export async function parseClosure(groovy) {
  return request(apiRoot + '/parseClosure', {
    method: 'POST',
    data: {
      groovy
    },
  });
}

export async function loadCommits(from, count) {
  return request(apiRoot + '/loadCommits', {
    method: 'POST',
    data: {
      from,
      count
    }
  })
}