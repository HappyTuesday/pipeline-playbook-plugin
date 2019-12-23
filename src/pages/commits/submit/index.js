import {Component} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';
import {Button, Card, Icon, Spin} from "antd";
import {DeployRecordView} from "../../../components/DeployRecord";

@connect(({ deployTable }) => ({
    draft: deployTable.draft,
    submitting: deployTable.submitting,
    targetBranch: deployTable.targetBranch
}))
export default class CommitSubmitPage extends Component {

    onSubmit = () => {
        let {draft, dispatch, targetBranch} = this.props;
        if (!draft) {
            return;
        }

        dispatch({
            type: "deployTable/commitDraft",
            payload: {draft, targetBranch}
        })
    };

    renderContent() {
        let {draft, submitting} = this.props;

        if (submitting) {
            return <Spin indicator={<Icon type="loading" style={{ fontSize: 24 }} spin />}/>
        }
        if (!draft) {
            return <span>Draft is clean</span>;
        }

        return (
            <div>
                <DeployRecordView deployRecord={draft}/>
                <Button type="primary" onClick={this.onSubmit}>Submit</Button>
            </div>
        )
    }

    render() {
        let {draft} = this.props;

        return (
            <PageHeaderWrapper title={draft ? `Submit #${draft.commit.parentId}` : 'Draft is clean'}>
                <Card>
                    {this.renderContent()}
                </Card>
            </PageHeaderWrapper>
        )
    }
}