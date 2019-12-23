import React, {PureComponent} from 'react';
import { connect } from 'dva';
import PageHeaderWrapper from '../../components/PageHeaderWrapper';
import {CommitListView} from "../../components/DeployRecord";
import {Select, Card} from "antd";

@connect(({ deployTable }) => ({
    deployRecords: deployTable.deployRecords,
    loadingCommits: deployTable.loadingCommits,
    targetBranch: deployTable.targetBranch,
    allBranches: deployTable.allBranches
}))
export default class CommitListPage extends PureComponent {

    state = {
        selectedBranch: undefined
    };

    onSelectBranch = branchName => {
        this.setState({selectedBranch: branchName})
    };

    getActualBranchName() {
        let {targetBranch} = this.props;
        let {selectedBranch} = this.state;
        return selectedBranch || targetBranch;
    }

    renderBranchSelect() {
        let { allBranches} = this.props;

        return (
            <Select
                placeholder="Select a branch"
                value={this.getActualBranchName()}
                onSelect={this.onSelectBranch}
                loading={!allBranches}
                style={{minWidth: "5em"}}
            >
                {allBranches && allBranches.map(b => (
                    <Select.Option value={b.name}>{b.name}</Select.Option>)
                )}
            </Select>
        )
    }

    getDeployRecords() {
        let {allBranches, deployRecords} = this.props;
        let branchName = this.getActualBranchName();
        if (!allBranches || !branchName) {
            return {rs: []};
        }
        let branch = allBranches.find(b => b.name === branchName);
        if (!branch) {
            return {rs: []};
        }
        let rs = [], finished = true;
        for (let id = branch.head; id;) {
            let r = deployRecords.get(id);
            if (!r) {
                finished = false;
                break;
            }
            rs.push(r);
            id = r.commit.parentId;
        }
        if (rs.length === 0) {
            let {dispatch} = this.props;
            dispatch({type: 'deployTable/fetchCommits', payload: {from: branch.head, count: 10}})
        }
        return {rs, finished}
    }

    loadingMore = deployRecords => {
        let from;
        if (deployRecords && deployRecords.length > 0) {
            let r = deployRecords[deployRecords.length - 1];
            from = r.commit.parentId;
        } else {
            let {allBranches} = this.props;
            let branchName = this.getActualBranchName();
            if (allBranches && branchName) {
                let branch = allBranches.find(b => b.name === branchName);
                if (branch) {
                    from = branch.head;
                }
            }
        }

        let {dispatch} = this.props;
        dispatch({type: 'deployTable/fetchCommits', payload: {from: from, count: 10}})
    };

    render() {
        let {loadingCommits} = this.props;
        let {rs, finished} = this.getDeployRecords();
        return (
            <PageHeaderWrapper title="Commits" extra={this.renderBranchSelect()}>
                <Card>
                    <CommitListView
                        deployRecords={rs}
                        loading={loadingCommits}
                        loadingMore={!finished && (() => this.loadingMore(rs))}
                    />
                </Card>
            </PageHeaderWrapper>
        );
    }
}