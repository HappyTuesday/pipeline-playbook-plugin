import {Component} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';
import {Card} from "antd";
import {DeployRecordView} from "../../../components/DeployRecord";

@connect(({ deployTable }) => ({
    deployRecords: deployTable.deployRecords
}))
export default class CommitDetailPage extends Component {

    state = {
        loaded: []
    };

    getCommitId() {
        let {
            match: { params: { id } }
        } = this.props;
        return Number.parseInt(id || '0');
    }

    render() {
        let {deployRecords} = this.props;
        let id = this.getCommitId();

        let deployRecord = deployRecords.get(id);

        if (!deployRecord && !this.state.loaded.includes(id)) {
            let {loaded} = this.state;
            if (!loaded.includes(id)) {
                this.setState({loaded: [...loaded, id]});
                let {dispatch} = this.props;
                dispatch({type: 'deployTable/fetchCommits', payload: {from: id, count: 1}});
            }
        }

        return (
            <PageHeaderWrapper title={`Commit #${id}`}>
                <Card loading={!deployRecord}>
                    {deployRecord && <DeployRecordView deployRecord={deployRecord}/>}
                </Card>
            </PageHeaderWrapper>
        )
    }
}