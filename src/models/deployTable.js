import {getBranches, loadCommits, getDeployTable, saveDraft} from '../services/api'
import {DeployInfoTable, ProjectPlaybookInfo} from "../business/DeployInfoTable";
import {DeployModelTable} from "../business/DeployModelTable";
import {Branch, Commit, DeployRecords, DeployRecordTable} from "../business/DeployRecordTable";
import {notification, message} from "antd";
import {mapValues} from "../functions/collection";

export default {
  namespace: 'deployTable',

  state: {
    deployInfoTable: {},
    projectPlaybooks: {},
    deployModelTable: {},
    submitting: false,
    draft: null,
    targetBranch: 'master',
    allBranches: undefined,
    deployRecords: new DeployRecords(),
    loadingCommits: false
  },

  effects: {
    *fetchDeployTable({ payload }, { call, put }) {
      const response = yield call(getDeployTable, payload);
      if (!response) {
        return;
      }
      yield put({
        type: "updateDeployTable",
        payload: response
      });
      yield put({
        type: 'global/loading',
        payload: false
      });
      message.success("Deploy Table has been fetched successfully!")
    },
    *commitDraft({payload: {draft, targetBranch}}, { call, put }) {
      if (draft) {
        yield put({type: 'beginSubmitting'});
        let {error, commit} = yield call(saveDraft, targetBranch, draft);
        yield put({type: 'finishSubmitting', payload: !error});
        if (error) {
          notification.error({message: "Submitting Draft met an error: " + error})
        } else {
          yield put({
            type: "upgradeCommit",
            payload: commit
          });

          yield put({
            type: 'updateBranchHead',
            payload: {
              branchName: targetBranch,
              head: commit.id
            }
          });

          message.success("Draft has been committed successfully!")
        }
      }
    },
    *fetchBranches({ payload }, { call, put }) {
      let branchesJson = yield call(getBranches);
      if (branchesJson) {
        yield put({type: 'updateBranches', payload: branchesJson});
      }
    },
    *fetchCommits({ payload: {from, count}}, { call, put }) {
      yield put({type: 'setLoadingCommits', payload: true});
      let deployRecords = yield call(loadCommits, from, count);
      if (deployRecords) {
        yield put({type: 'appendCommits', payload: deployRecords});
        yield put({type: 'setLoadingCommits', payload: false});
      }
    }
  },

  reducers: {
    updateDeployTable(state, {payload}) {
      let infoTable = new DeployInfoTable(payload.infoTable);
      let projectPlaybooks = mapValues(payload.projectPlaybooks, x => new ProjectPlaybookInfo(x));
      return {
        ...state,
        targetBranch: payload.storageBranch || "master",
        deployInfoTable: infoTable,
        projectPlaybooks: projectPlaybooks,
        deployModelTable: new DeployModelTable(infoTable, projectPlaybooks)
      }
    },
    updateBranches(state, {payload}) {
      return {
        ...state,
        allBranches: payload.map(b => new Branch(b))
      }
    },
    updateTargetBranch(state, {payload}) {
      let allBranches;
      if (state.allBranches) {
        if (state.allBranches.any(b => b.name === payload)) {
          allBranches = state.allBranches;
        } else {
          allBranches = [new Branch({name: payload}), ...state.allBranches];
        }
      } else {
        allBranches = [new Branch({name: payload})];
      }
      return {
        ...state,
        allBranches: allBranches,
        targetBranch: payload
      }
    },
    upgradeCommit(state, {payload: commit}) {
      return {
        ...state,
        deployInfoTable: state.deployInfoTable.update({commit}),
        deployModelTable: state.deployModelTable.update({commit})
      }
    },
    beginSubmitting(state) {
      return {
        ...state,
        submitting: true
      }
    },
    updateDraft(state, { payload: {record, operator} }) {
      let {draft, deployInfoTable} = state;
      if (!draft) {
        draft = new DeployRecordTable();
        draft.commit = new Commit({...deployInfoTable.commit, id: undefined, parentId: deployInfoTable.commit.id});
      }
      draft = draft[operator](record);
      let infoTable = deployInfoTable.withRecordTable(draft);
      return {
        ...state,
        deployInfoTable: infoTable,
        deployModelTable: new DeployModelTable(infoTable, state.projectPlaybooks),
        draft
      }
    },
    finishSubmitting(state, { payload: succeed}) {
      let newState = {...state, submitting: false};
      if (succeed) {
        newState.draft = null;
      }
      return newState;
    },
    setLoadingCommits(state, { payload }) {
      return {
        ...state,
        loadingCommits: payload
      }
    },
    appendCommits(state, { payload }) {
      return {
        ...state,
        deployRecords: state.deployRecords.append(payload)
      }
    },
    updateBranchHead(state, { payload: {branchName, head}}) {
      let {allBranches} = state;
      let finalBranches = [];
      for (let b of allBranches) {
        if (b.name === branchName) {
          finalBranches.push(new Branch({name: branchName, head: head}));
        } else {
          finalBranches.push(b);
        }
      }
      return {
        ...state,
        allBranches: finalBranches
      }
    }
  }
};
