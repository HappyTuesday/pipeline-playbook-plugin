import {PureComponent} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';

import {EnvironmentView} from "../../../components/Environment";
import {Card} from "antd";

@connect(({ deployTable }) => ({
    envs: deployTable.deployModelTable.envs
}))
export default class EnvironmentDetailPage extends PureComponent {

    onAssignment = (assign) => {
        let {dispatch} = this.props;
        dispatch({
            type: "deployTable/updateDraft",
            payload: {
                record: assign,
                operator: 'addAssign'
            }
        })
    };

    render() {
        const {
            envs,
            match: { params: { name = "shared.defaults" } }
        } = this.props;

        const env = envs.get(name);

        return (
            <PageHeaderWrapper title={`Environment ${name}`}>
                <Card>
                    <EnvironmentView env={env} onAssignment={this.onAssignment}/>
                </Card>
            </PageHeaderWrapper>
        )
    }
}